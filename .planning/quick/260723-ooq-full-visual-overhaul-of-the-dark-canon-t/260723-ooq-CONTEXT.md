# Quick Task 260723-ooq: Full visual overhaul of the DARK-canon tester-challenge email - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Task Boundary

Full visual overhaul of `references/design/newsletter-email-template.html` (the DARK-canon tester-challenge email template, 640px table-based HTML email, sent to active brain_api_keys holders). This is a from-scratch redesign, not a patch -- three real, diagnosed problems drove this: (1) two contradictory palette docs exist in this repo (`references/design/email-template-standard.md`'s muted ds-* palette vs the actual canonical template's brighter mos-* palette), (2) every content section uses the identical "#1A1A1A card + thin colored left border" shape with no real visual hierarchy, (3) the headline font (`Impact, 'Arial Black', Arial, sans-serif`) is designed around a font almost nobody has installed, so it silently degrades to plain bold Arial for most recipients with none of the intended graphic punch.

New content: v1.15.3-beta.44 (Memgraph-backed Brain migration) plus this week's reliability hardening, framed as "MindrianOS is much more powerful now."

</domain>

<decisions>
## Implementation Decisions

### Hero image
Generate a NEW custom hero image built around the magnetic-vs-inertial confinement visual concept (two competing families, neither dominant -- echoing the fusion-confinement section added to the-beam-nobody-has-won blog post this session). No standalone image file for that concept exists yet (the blog's fusion section is a CSS/text card treatment, not a rendered image) -- this is a fresh asset, not a literal file reuse. Reuse the blog hero-image generation pipeline already proven this session (nano-banana/Gemini via Node, sharp-compressed) rather than inventing a new image pipeline.

### Content emphasis
Broad "everything got better" framing. Headline: the Memgraph-backed Brain migration. Supporting proof points: this week's reliability hardening (the Windows fixes trilogy -- os.rename, sys.argv interpolation, bash argv-mangling -- plus the Stop-hook JSON-schema fix) as evidence MindrianOS is maturing fast, not just adding one feature. Keep Feynman-simple per the newsletter playbook's own "who cares / why" requirement -- this is proof-of-momentum, not a changelog dump.

### Recipient scope
Re-query active brain_api_keys FRESH now (via `mcp-server-brain/brain-admin.cjs list`, the same real mechanism used for the prior newsletter issue) -- do not reuse the stale 42-count from the earlier session, the list may have changed.

### Claude's Discretion
- Exact new panel/layout system replacing the monotone left-border-card repetition (full-bleed Mondrian color blocks are the recommended direction per the diagnosis already given to the user, but exact composition is left to the planner/executor).
- Exact typography sizing/spacing strategy for the headline given it will render as bold Arial for most recipients (design FOR that reality rather than pretending Impact will show).
- Whether to reconcile the two conflicting palette docs by updating `email-template-standard.md` to match the actual canonical template, or vice versa -- pick whichever is the more broadly-referenced/canonical one and make the other point to it, do not just leave both existing with different values.

</decisions>

<specifics>
## Specific Ideas

- The newsletter playbook (`feedback_newsletter_story_challenge_playbook.md`, this user's standing hard rule) still governs: DARK theme, #0D0D0D bg, inline styles only, no `<style>` block, no web fonts beyond Impact/Arial Black/Helvetica/Arial/Courier, no border-radius, no emoji, no em-dashes, sender is always a person (never "MindrianOS Team"), mindrian-os.com appears 3+ times, STEP 0 update callout mandatory naming the real version.
- This redesign is scoped to the DARK tester-challenge email template specifically. Do NOT touch the personal founder-voice email template (a different, lighter-theme email used once this session, `email2-personal.html` scratchpad) -- that is a separate, already-used template, out of scope here.
- Do NOT create or send actual Gmail drafts as part of this quick task unless the user explicitly asks for that in a follow-up -- this task is the redesign + new content draft, matching this session's established two-step pattern (prepare, then explicit go-ahead before any live send).

</specifics>

<canonical_refs>
## Canonical References

- Current template: `references/design/newsletter-email-template.html` (the file being redesigned).
- Conflicting docs to reconcile: `references/design/email-template-standard.md` vs the template's own inline header comment block.
- Standing hard rule: `feedback_newsletter_story_challenge_playbook.md` (user's global memory).
- Recipient query mechanism: `mcp-server-brain/brain-admin.cjs list` (real Supabase REST query, same as the prior newsletter issue).
- Hero image generation precedent: this session's blog hero-image pipeline (nano-banana/Gemini via Node, sharp-compressed to ~1800px/q82).

</canonical_refs>
