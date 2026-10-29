# L2 erosion history: how Larry's voice changed from the last persona phase to HEAD

Repo used for all git reads: /home/jsagi/dev/MindrianOS-Plugin (branch release/beta.77-stamps, HEAD d6a2fdbaa, 2026-10-27). The path /home/jsagi/MindrianOS-Plugin is an empty stub and was not used for history. Nothing was written to either repo except this file. Marks: PROVEN = read or run; UNVERIFIED = not run; PENDING-HUMAN = owner decision.

## 1. Which phase was the last "Larry phase of its own"

- PROVEN. Phase 210 "Revert Persona-Enforcement Over-Reach" (registered 2026-07-02, plans 01-07 done, last plan commit 062cdec88 on 2026-07-03). Source: .planning/phases/210-revert-persona-enforcement-over-reach-selectively-undo-the-m/210-CONTEXT.md. It exists because the owner said on 2026-07-02 that 1.15.x "behaves less like Larry". Its own count: 116 of 366 commits in v1.15.0-beta.13..v1.15.2 (about 32 percent) were persona or voice enforcement machinery.
- PROVEN. Later Larry-adjacent phases: 243 (voice glyph, verified 2026-07-28), 359 (prose fork, 2026-10-28), 369.6 "The Larry contract: voice and calibration" (ROADMAP.md line 1929). Phase 369.6 shows "Plans: 0 plans" and has no phase directory: it was never executed. SEED-121 is dormant until 369.6 (comment in the agents/larry-extended.md frontmatter).
- Baselines used: A = 9235c9f1a / 03adbffbd (2026-03-20, the original port of V2 Larry). B = 6d98e7cd8 (Phase 210-05, 2026-07-03), the last commit of the last full persona phase. H = HEAD.
- Phase 210 itself was a net strengthen for the voice. Everything after it is the drift: 39 commits touched the three persona files between B and HEAD, and 33 between A and B. PROVEN by git log on agents/larry-extended.md, skills/larry-personality/SKILL.md, references/personality/voice-dna.md.

## 2. Measurement: voice versus machinery

Counting rules (so they can be redone). Text = file body without YAML frontmatter, non-blank lines, in bytes. Each section is assigned to a class by its heading:
- VOICE: Voice, Cardinal Sin, Conversation Flow, Silent Problem Classification, Aronhime DNA, Room Awareness, Non-Methodology Questions, Never Do, Always Do, Elevation / Three Directions, Two Modes, Dial Curve, Golden Rule, Thinking Trace, Breakthrough Voice Scaffold, Sourced Claims, Theo-by-name, thin grounding, no fake recall, Integration Offers, Proactive Filing Offer.
- BRAND: the "Voice Signature" section and the identity paragraphs (glyph plus label "Larry | MindrianOS", "powered by Claude").
- MACHINERY: everything else (reach, dial operation, gates, handoff, routing, memory channels, stamps, Persona-Aware Turn 1, dual-path detection, SEED-117 room failure, onboarding, stance, Usher).
This is a heading-level heuristic and it is generous to voice (teaching doctrine such as Elevation counts as voice). The script lives in the session scratchpad, not in the repo.

| Snapshot | File | File bytes | Voice | Brand | Machinery |
|---|---|---|---|---|---|
| A 2026-03-20 | larry-extended.md | 2976 | 97.4% | 0.0% | 2.6% |
| A 2026-03-20 | SKILL.md (03adbffbd, 36 lines) | 1548 | 74.6% | 0.0% | 25.4% |
| B 2026-07-03 | larry-extended.md (181 lines) | 17135 | 22.2% | 11.6% | 66.2% |
| B 2026-07-03 | SKILL.md (448 lines) | 48561 | 23.5% | 7.1% | 69.3% |
| H HEAD | larry-extended.md (224 lines) | 22211 | 27.8% | 14.2% | 58.0% |
| H HEAD | SKILL.md (667 lines) | 73369 | 21.1% | 6.8% | 72.0% |

voice-dna.md: 3905 B at A, 5311 B at B, 6691 B at H (117, 156, 166 lines). It is a voice file, but the additions are a branding block (3b918036f), a Simon watchmaker explainer (d534a8df7) and a dash-label rename (b73a0386b). No voice trait was added. PROVEN by git diff 9235c9f1a..HEAD.

Combined agent body plus SKILL voice share by classified bytes: about 90 percent at A, about 23 percent at B, about 22.5 percent at H.

Core voice only (sections Voice, Cardinal Sin, Conversation Flow, Silent Classification, Aronhime DNA, Never Do, Always Do) in the agent body: A 1880 B of 2584 B body (72.8 percent); H 2447 B of 19619 B body (12.5 percent). PROVEN by script.

Reading of the numbers:
1. The core voice text was not deleted. It grew slightly (1880 to 2447 B) through additions (hyphen rule, Theo-by-name exception in Never Do, gate clause in Always Do). Voice lines removed in the agent between A and B: the description sentence about "warmth and intellectual rigor", the line "First line to new users: I'm Larry. What are you working on?" (removed in 159867c34, 2026-06-07, after initialPrompt came in via 0c6b5ff6d and 99173b657), and the unconditional force of "End with a question or next step" (e1edcdc92). PROVEN by git diff 9235c9f1a..6d98e7cd8.
2. The erosion is dilution by volume, not deletion. Voice stayed near 2 to 2.5 KB while the text around it grew: the agent file 2976 B to 22211 B (about 7x), the skill 1548 B to 73369 B (about 47x).
3. The SessionStart hook never carried voice. In scripts/session-start the stable_prefix is "You are Larry." plus a platform description. At ccf4b33e1 (2026-07-05) the rest was UI Enforcement and JTBD-context-only text; at HEAD (lines 367-373) the rest is the glyph, label and "powered by Claude" rule. Neither has Voice, Cardinal Sin or the Reframe. So voice reaches the model only through the agent body (settings.json sets "agent": "larry-extended") and the larry-personality skill. PROVEN. UNVERIFIED: whether the agent body loads on every surface.

## 3. Timeline (persona files; related commits grouped)

Files: AG = agents/larry-extended.md, SK = skills/larry-personality/SKILL.md, VD = references/personality/voice-dna.md. Class: strengthen, neutral, dilute, conflict.

| Date | Commit | Files | Class | Effect |
|---|---|---|---|---|
| 2026-03-20 | 9235c9f1a, 03adbffbd | AG +59, VD +117, SK +36 | origin | Voice, Cardinal Sin, Reframe, escape hatch, Ask-Tell dial. 97 percent voice. |
| 2026-03-24 | d534a8df7 | VD +39 | neutral | Simon watchmaker explainer. |
| 2026-03-25 | 5579ace81 | SK +62 | neutral | Thinking traces and visual confirmations. |
| 2026-03-26 to 04-01 | 34af9befa, f3010b47f, e01e7ae01, 502c3385d | SK +28, +32, +104/-24, +32 | dilute | Integration offers, onboarding invitation, "Provoked" mode: Larry pitches a command every 3-5 turns with a JTBD formula (a 3999 B section still present at HEAD). Sales machinery inside the persona skill. |
| 2026-04-05 | 1f84fa10d | SK +79/-212 | neutral | "Compress to native-first" rewrite; removed traces, visual patterns and long examples. |
| 2026-04-14, 04-15 | 66b59acc0, eac5536a0 | SK +43, +26 | dilute | Honesty-about-memory and voice-lock sections: tooling rules, not tone. |
| 2026-05-05 | 0c6b5ff6d, 99173b657, e04f19b67 | AG +6, +12, +60 | conflict | Persona-Aware Turn 1 and Dual-Path Detection (about 40 lines of procedure); 10 persona_variants strings (7 alias the default). Turn 1 scripted verbatim, against "rotate naturally". |
| 2026-05-17 to 06-12 | f28e73e93, 06a944b80, 143.2 series, 148-01, 150.x | SK about +200 total | dilute | Capability Dial, Usher division, Operating the Dial, reach rules, routing_source: an operator manual for the reach engine inside the persona skill. |
| 2026-06-07 | 159867c34 | AG +9/-7 | dilute | Deleted the first-line rule and the Aronhime description; added a machinery pointer. |
| 2026-06-18 | 6d9409329 | AG +14, SK +2 | dilute | Post-Gate Handoff to chain-executor (dense runChain contract in the agent body; never trimmed since). |
| 2026-06-27, 06-28 | c178b7dc2, 72615fdf4 | AG +12, SK +20, +13/-11 | conflict | Voice Signature: every turn opens with a colored square glyph; "a turn with no glyph reads as the raw host". A format rule placed ahead of the voice rules. |
| 2026-07-01 | 3861be05e | AG +4, SK +20 | neutral | Three Directions of Elevation (from Lawrence feedback). Teaching content. |
| 2026-07-02 | e1edcdc92 | AG +9/-1 | conflict | "Decision Gates - fire the card": mandatory, BINDING. Also rewrote "End with a question" so the question must be a card, never prose. Matches the owner's complaint in memory file feedback_1_15_enforcement_regression_watch.md. |
| 2026-07-02 | 2d31c50b3 | SK +21 | conflict | Stance toggle footer offered every turn; glyph locked per stance. |
| 2026-07-03 | 1770938c1, 6d98e7cd8 (Phase 210) | SK +2/-2, AG +2/-2 | strengthen | Footer only when relevant; forced glyph becomes a default; card only on a genuine unanswered fork. Baseline B. |
| 2026-07-16 | cd5d14f80 | SK +10 | dilute | Ignite and Hooked-model gate timing (2929 B). |
| 2026-07-28 to 08-28 | a6bd6097b, c2f0e0680, 5f4a68451, 9d2b5e43b, 6d3b27862 | SK, AG small | neutral | Spec normalisation, citation anchors, Usher fix. |
| 2026-09-05 to 09-08 | fa21f1e25, faef7e50d, 70c15d04a, 32ec2c410, 4a149a4df, c1bfc72a9, 41dea758c | AG +10, +19, +4, +4; SK +44, +12, +49 | dilute | Sourced Claims, honest-about-thin-grounding, Theo-by-name, two-pass ordering, D3/D4/D5 operating contract, operating policy. Sound rules for trust, but they are MUST/NEVER prose; about 6 KB added. |
| 2026-09-07 | 829e26df3, b73a0386b | AG +3/-1, SK +2, VD +2/-2 | conflict (small) | Hyphens-only rule; the pause "em-dash before the reveal" became " -- ". |
| 2026-09-16 to 09-27 | 7fb0030dc, 5fffa21d6, e435262b4, 5164d3bae, 54a35e031, b3b669aa6 | SK +29, +28, +25, +10 | dilute | Superseded doctrine, Dominant Design routing, stamps narrated verbatim, ambient findings: about 5 KB of routing and stamp text. |
| 2026-09-23 | 2a91bf375 (Phase 357-10) | AG +1/-5, SK +1/-1 | strengthen | Card-rule prose cut from 2230 B to 856 B by deferring to the code gate. Only deliberate shrink after Phase 210. |
| 2026-10-05 | 5b42ad733, e5489101b, 80ef6a9d5 | AG +4, +1, +1/-1; SK +1/-1 | conflict | SEED-117 room-failure rule, SEED-121 pointer, "a yes is a card, never prose": typed words never answer a gate. |
| 2026-10-11 | 05a0415ff, 3b918036f | AG +8/-4, SK +6/-2, VD +10 | conflict | Branding: every reply opens with glyph plus "Larry \| MindrianOS"; first reply must say "I'm Larry, MindrianOS's PWS thinking partner, powered by Claude"; turn 1 persona variant must drop its own "I'm Larry." clause. Also clashes with frontmatter initialPrompt "I'm Larry. What decision is stuck?", which the body must patch around. |
| 2026-10-19 | c53beea37 | VD +2/-2 | neutral | Host-neutral identity wording. |
| 2026-10-28 | 656cd8a34 (Phase 359-09) | AG +2, SK +1/-1 | conflict (small) | "Your call: A \| B \| What if C" as a fixed last line for prose forks. A fixed closer is a template. |

Tally by timeline row (rows group commits): strengthen 2 (Phase 210, Phase 357-10); conflict 9; dilute 7; neutral 6; plus the origin row.

## 4. Commits that diluted the voice most

1. The v1.15 enforcement group: 72615fdf4 (2026-06-28, glyph on every turn), e1edcdc92 (2026-07-02, mandatory card, rewrote "End with a question"), 2d31c50b3 (2026-07-02, footer every turn). Partly reversed by Phase 210 (6d98e7cd8, 1770938c1). PROVEN by diff and 210-CONTEXT.md.
2. 05a0415ff (2026-10-11), the branding commit: label ahead of every reply, scripted first sentence, rewritten turn 1. Not reversed. PROVEN.
3. e04f19b67, 99173b657, 0c6b5ff6d (2026-05-05): persona-variant and dual-path machinery, about 50 lines in the body, never trimmed.
4. The reach, dial and Usher documentation (06a944b80, 143.2 series, 6d3b27862): the "When to Reach" and "Hierarchical Navigator" blocks together are a large share of SKILL.md (section sizes from the heading dump; exact share UNVERIFIED).
5. The September honesty and stamp batch (fa21f1e25 through e435262b4): about 8 KB across agent and skill.
6. e01e7ae01 and f3010b47f (2026-04-01): Provoked-mode command pitching (3999 B, unchanged since).

## 5. Likely erosion mechanisms, ranked by evidence

1. Volume dilution. PROVEN. Core voice is 12.5 percent of the agent body and about 21 percent of the skill (generous rule) at HEAD. The voice rules sit between long MUST/BINDING sections.
2. Hard format rules ahead of the voice. PROVEN. Glyph plus label on every reply, scripted first sentence, scripted turn 1, fixed "Your call:" closer. The first words of each reply are dictated by branding, not by "Very simply..." or the Reframe. The Voice section is third in the body, after two identity paragraphs.
3. Gate machinery overriding the closing voice rule. PROVEN. "End with a question or next step" became "at a Decision Gate the question IS the card, never a prose question" (e1edcdc92), then "a yes is a card, never prose" (80ef6a9d5). Phase 210 softened when cards fire; the ban on the prose question stayed.
4. Competing voice text on other surfaces. PROVEN for the text I can see in this session: the plugin:mos MCP server instructions say "You are Larry" and then list gates, tools and boundaries, with no Voice, Cardinal Sin or Reframe lines. The Theo-Claude guide in the same session says to adopt no human persona and not to end with a question or use repeated closers. UNVERIFIED: which host loads which text and in what order.
5. The SessionStart hook carries no voice (section 2, point 3). A session where the agent body does not load gets a labelled generic host.
6. Scripted turn 1 and dual-path detection. PROVEN as text; effect on tone UNVERIFIED.
7. Honesty and sourced-claims rules written as prohibitions. Added prose is PROVEN; the effect on tone is UNVERIFIED.
8. House dash rule replacing "em-dash before the reveal" (829e26df3). PROVEN, small.

## 6. Counter-evidence

- The core voice lines (Voice, Reframe, Cardinal Sin, Silent Classification, Aronhime DNA, escape hatch) are intact and verbatim apart from the dash change. PROVEN.
- Phase 210 reversed the worst v1.15 over-reach (always-fire cards, every-turn footer). PROVEN.
- Phase 357-10 is a precedent for shrinking persona prose under a measured gate (2230 B to 856 B). PROVEN.

## 7. Cannot be verified from history

- Whether Larry sounds less like Lawrence in a live conversation. This lens reads text, not sessions. PENDING-HUMAN: needs transcript comparison with the Lawrence style guide (not read by this lens).
- Which surfaces (CLI, Desktop, Cowork, MCP hosts) load the agent body and the skill. UNVERIFIED; needs a runtime check.
- Installed copies (beta.69, beta.73, beta.75 under ~/.claude/plugins/cache/mindrian-marketplace/mos/) were not diffed against the dev repo. HEAD of the dev repo is on release/beta.77-stamps. Whether 656cd8a34 (2026-10-28) and 05a0415ff (2026-10-11) are in beta.75 is UNVERIFIED.
- The percentages depend on my heading classification. A strict rule (only the seven core sections count) gives 12.5 percent at HEAD against 72.8 percent at origin; a loose rule gives 27.8 percent. The direction is the same under both.
- No eval or transcript data scoring "Larry-ness" per commit was read.
- Theo tools persona_card and larry_move, and lib/hmi/voice-color-mark.cjs, were out of scope beyond noting they exist.
