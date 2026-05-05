'use strict';

/*
 * Phase 115 -- Owned Emotion Spec Strings (single source of truth)
 * =================================================================
 * Per 115-RESEARCH.md `## Pitfalls and Failure Modes` Pitfall 1 mitigation,
 * every downstream surface rewrite imports from this file rather than
 * hardcoding spec strings. Frozen at ship; D-20 rollback only mutates
 * the per-string values, never the module shape.
 *
 * Sources:
 *   D-02..D-05 verbatim from the-owned-emotion.md `## Design implications`
 *   D-06..D-09 from 115-CONTEXT.md `<decisions>`
 *   D-17 default initialPrompt from 115-RESEARCH.md DISCRETION-02 Resolution
 *
 * Canon: Part 10 sub-claim 2 ("Conversation IS the surface").
 *
 * Hard rules (CLAUDE.md): no emoji, no em-dashes; hyphens only in copy.
 *   The string "can't" uses U+0027 APOSTROPHE; "Let's" uses U+0027.
 *   Spec strings are ASCII-7 except for the apostrophes which are U+0027.
 */

const SPEC_STRINGS = Object.freeze({
  // D-02 /mos:splash copy
  SPLASH_COPY: "Stuck on a decision you can't name? Let's find the shape of it.",

  // D-03 /mos:new-project first message
  NEW_PROJECT_OPENER: "I'm Larry. What decision is stuck?",

  // D-04 marketing line (also used as D-08 README hero + D-09 website hero)
  MARKETING_LINE: "For founders stuck on a decision they can't name.",

  // D-05 Dror 2.0 test subject criteria
  DROR_TEST_CRITERIA: "a founder who is stuck on a decision right now and cannot name it.",

  // D-06 / D-17 default initialPrompt (the platform-fired turn-1 string for
  // agents/larry-extended.md; persona_variants.default echoes this verbatim
  // per RESEARCH DISCRETION-02 resolution)
  INITIAL_PROMPT_DEFAULT: "I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)",

  // D-07 /mos:onboard opening framing (lead-with-emotion paragraph; lands
  // BEFORE methodology pitch in commands/onboard.md Step 1)
  ONBOARD_OPENING_FRAMING: "Very simply -- if you're here, you're probably stuck on a decision you can't quite name. That's the feeling MindrianOS is built for. Let's find the shape of it together.",

  // D-08 README hero tagline (alias of MARKETING_LINE; surface is the GitHub
  // front door + marketplace listing source)
  README_HERO_TAGLINE: "For founders stuck on a decision they can't name.",

  // D-09 website hero tagline (alias of MARKETING_LINE; out-of-repo
  // deliverable applied manually to ~/mindrian-website/ post-merge per
  // CHANGELOG action item -- Pitfall 4)
  WEBSITE_HERO_TAGLINE: "For founders stuck on a decision they can't name.",
});

module.exports = SPEC_STRINGS;
