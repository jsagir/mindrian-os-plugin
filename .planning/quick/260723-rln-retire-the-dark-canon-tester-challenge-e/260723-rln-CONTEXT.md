# Quick Task 260723-rln: Retire DARK-canon tester email, unify to cream M:OS system - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Task Boundary

Retire the DARK-canon tester-challenge email design (`references/design/newsletter-email-template.html`, `references/design/email-template-standard.md`) and unify it with the cream-default M:OS Canonical Design System v1.1 that now governs every other HTML artifact (decks, dashboards, wiki, exports, snapshots, hub/lobby). This explicitly reverses a prior standing rule in `feedback_newsletter_story_challenge_playbook.md` ("Part B - The challenge email (DARK tester-email canon)... NOT the website's light paper look") -- the navigator was shown the contrast directly and chose to unify to cream.

</domain>

<decisions>
## Implementation Decisions

### Code/command blocks stay dark (terminal-island treatment)
Selected alongside "you decide" -- interpreted as: use the strongly-grounded recommended answer without a further round. The challenge-seed Courier box and the command-chain block KEEP a dark terminal-style treatment (dark background, gold/cream monospace text) even inside the otherwise-cream email, matching the website's own established De Stijl canon precedent: "Dark is reserved for terminal islands only" (website/CLAUDE.md). This is not a full-dark email anymore, just these two code-shaped blocks staying dark as an intentional terminal-island accent, exactly like the rest of this design system already does elsewhere.

### Hero image
Use judgment (deferred, "you decide"). The hero image already has a mostly white/cream De Stijl-grid background itself, so it likely reads BETTER on a cream email ground than it did on dark -- probably just needs the frame/border color re-tuned (e.g. from cream-on-dark border to an ink/black-on-cream border) rather than regenerating the image itself. Confirm this holds visually during execution; regenerate only if the image genuinely does not read well against the new cream ground.

### Claude's Discretion
- Exact M:OS canonical hex values to use (pull verbatim from skills/ui-system/design-system/mos-design-system.css, do not invent new ones).
- Exact panel/card re-skinning approach for the full-bleed Mondrian panels (STEP 0 callout, what's-new cards, triple-feature rail) -- preserve the differentiated-shape structural win from the earlier same-day redesign (quick task 260723-ooq), just re-skin colors.
- Whether email-template-standard.md needs its Structure/Typography/Component-Pattern sections substantially rewritten or just its color-value rows updated.

</decisions>

<specifics>
## Specific Ideas

- This is the SECOND redesign of this same email template today (first: 260723-ooq, dark-canon full-bleed-Mondrian-panel visual overhaul). Preserve every structural/layout win from that redesign (differentiated panel shapes instead of monotone left-border cards, bold-Arial-aware headline sizing, the hero-image section) -- this task only re-skins the color palette from dark to cream, it does not re-architect the layout again.
- HTML email cannot use CSS variables or a shared stylesheet (inline styles only, per this repo's own established email constraints, `mosStyleTag()` does not apply here) -- hex values must be hardcoded inline, matching the M:OS canonical values by literal hex match, not by reference.
- The already-drafted content instance (`docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` + `.md`) needs the same re-skin (same content, new palette).
- A REAL Gmail draft already exists for the old dark version (id `r-1370266653870026168`, filed earlier this session) -- this quick task does NOT touch the live Gmail draft (that is the orchestrator's job to handle separately, via `update_draft`, after this redesign lands and is reviewed). Do not attempt to call any Gmail tool from within this quick task.
- The user's own standing memory file (`feedback_newsletter_story_challenge_playbook.md`) documents the now-retired DARK-canon rule -- this quick task cannot edit that file directly (it lives outside this repo, at `~/.claude/projects/-home-jsagi/memory/`), but the SUMMARY should note clearly that the standing rule is now superseded, so the orchestrator can decide how to record that outside this repo.

</specifics>

<canonical_refs>
## Canonical References

- M:OS Canonical Design System v1.1 source of truth: `skills/ui-system/design-system/mos-design-system.css`, `SPEC.md`, `M-OS-DESIGN-SYSTEM.md`.
- The now-superseded standing rule: `~/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md` Part B (outside this repo, read-only reference).
- The earlier same-day structural redesign this task builds on: quick task `260723-ooq` (`.planning/quick/260723-ooq-full-visual-overhaul-of-the-dark-canon-t/`).
- Website's dark-as-terminal-island precedent: `website/CLAUDE.md` in the sibling mindrian-website repo ("Dark is reserved for terminal islands only").

</canonical_refs>
