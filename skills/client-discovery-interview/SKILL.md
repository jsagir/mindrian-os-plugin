---
name: client-discovery-interview
description: Use ONLY when the navigator explicitly signals they are starting a new client engagement (a website, brand, or UX build) and wants the discovery interview before any design begins -- not a casual remark about an existing site. Do NOT use for general conversation about a live product. Triggers (in a new-client-engagement context) - new-client kickoff, discovery phase, creative or design brief, brand discovery, client questionnaire, defining user personas and jobs-to-be-done, "understand the client before we design", "what should this site be".
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: client-discovery
  posture: hold
  hierarchy_rank: 15
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
hitl_shape: "F.1"
hitl_why: "Each of the six discovery movements closes with an F.1 Next Move choice (continue the movement, reframe, or move to the Discovery Brief), never silently auto-advancing."
---

<!-- mos:firing-block v2 -->
At this skill's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this skill's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# Client Discovery Interview

## Overview

Discovery before design. A web/UX firm does not start with pixels; it starts by understanding three souls - the client's brand, the product, and the users' jobs - through a guided, multi-turn conversation. You are an investigator, not a form. A form gets answers; a conversation gets the truth.

**Core principle:** You cannot design the site until you can say, in one breath, who this is for, what job they are hiring it to do, and what the brand would never say. Everything you design after that is strategic; everything before it is guesswork.

The output is a **Discovery Brief** that makes every later decision (structure, tone, visuals, the one key action) grounded instead of arbitrary.

## The investigator spirit (mindset, not a checklist)

- **One question at a time.** Never dump a questionnaire. The question bank is your back pocket, not your script.
- **Follow the thread.** Ask your next question from THEIR last answer, not your list.
- **Listen for the three tells:** repetition (what they say twice matters most), emotion (where energy spikes or drops), avoidance (what they skip past).
- **Reframe to reach the soul.** Abstract questions get brochure answers. Use concrete, sensory reframes: "If your brand were a person at a dinner party, who are they?" "If a customer walked into a physical lobby for this product, what should they feel the second they step in?" "What would your brand never say or do?"
- **Mirror and confirm.** Play back what you heard in your own words; let them correct you. The correction is the gold.
- **Prefer stories.** "Tell me about a time a customer got it" beats "what are your values". Stories carry more truth than adjectives.
- **Close every movement** with: "What have I not asked that I should have?"

## Multi-turn structure (six movements)

Run these as conversation movements across turns, not one survey. Adapt the order to what the client brings. Spend more turns where the energy and the ambiguity are.

1. **Warm-up and the real why.** Why now? Why does this project exist at all? What happens if it works - and what happens if nothing changes? (Surfaces stakes, urgency, and the internal reality behind the brief.)
2. **The brand's soul.** History, mission, the big why, values, and what they stand against. Personality and archetype (the 12: Outlaw, Creator, Magician, Hero, Lover, Jester, Everyman, Caregiver, Ruler, Innocent, Sage, Explorer). Voice: how they speak, and the "never says" list.
3. **The product's essence.** What it actually is, the one job it does best, what it replaces, the business case, the non-negotiable constraints, and what "done well" looks like.
4. **The users and their jobs (JTBD).** For each persona: who they are in context (not just demographics) AND why they "hire" this - the functional job, the emotional job, the social job. What they "fire" (today's alternative and why it falls short). The trigger that sends them looking in the first place.
5. **The competition and the whitespace.** Who they admire and why, who they refuse to resemble, and where the whole category looks the same (the sea of sameness to break).
6. **The site as a habit (Hooked).** Design the loop the finished product should create: **Trigger** (external prompt + the internal emotion it attaches to) -> **Action** (the simplest behavior; Fogg B=MAP, motivation x ability x prompt) -> **Variable Reward** (of the tribe, the hunt, or the self) -> **Investment** (what the user puts in that loads the next trigger and makes the product better for them). This turns "a website" into "a returning relationship".

## Hooked, used two ways

- **Designing the product:** movement 6 - the finished site should have a designed habit loop, not just pages.
- **Running the interview:** keep the client opening up with the same psychology. A clear prompt (one question), low effort to answer (concrete, not abstract), a small reward (reflect an insight back that makes them feel understood), and investment (each answer visibly builds the brief). Show the brief taking shape as you go; that visible progress is the investment hook that keeps them generous with the truth.

## The deliverable: Discovery Brief

Synthesize the conversation into one document. (The full prompt library that feeds each section is in `question-bank.md`.)

- **Brand soul:** one-line essence, the big why, core values, archetype + voice, and a "never says" list.
- **Product essence:** what it is, the one core job, the business case, the hard constraints.
- **Persona + JTBD cards:** per persona - context, functional/emotional/social job, the fired alternative, the trigger.
- **Positioning:** the whitespace, the thing to break, one sentence of differentiation.
- **Habit loop:** the trigger -> action -> variable reward -> investment design for the site.
- **Design implications:** what all the above means for structure, tone, visuals, and the single most important user action.
- **Open questions and assumptions:** what is still a guess. Flag it; never let a guess pass as a fact.

## Common mistakes

- Sending the question bank as a form. It is your back pocket, not your script.
- Collecting adjectives ("modern, clean, professional") and calling it a brand. Push to stories and "never says".
- Personas that are demographics with a stock photo. A persona without a job-to-be-done is decoration.
- Designing pages before defining the one action and the habit loop.
- Treating the client's stated solution as the brief. They hired you to find the real problem, not to transcribe the first one they named.
- Letting guesses harden into facts. Mark assumptions as assumptions.

## Reference

Full multi-phase question library, archetype-finding prompts, the JTBD job-interview script, the Hooked-loop worksheet, and the Discovery Brief template: see `question-bank.md` in this skill folder.
