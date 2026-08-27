---
name: splash
description: Display the MindrianOS Mondrian banner
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "See the MindrianOS welcome panel + version."
body_shape: E
hitl_shape: "F.1"
hitl_why: "The banner splash offers one next move to enter the room."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 19): first delivery at commands/splash.md:39, the hardcoded owned-emotion tagline, static first-touch copy that never varies, not a computed reward.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["explore"]
teaching: "When you want the MindrianOS Mondrian banner, /mos:splash displays it. Mostly decorative; useful for screenshots and demo openings."
allowed-tools: Bash AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Render command. Emits the splash / banner surface; a presentation-only render with no problem-state trigger."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:splash

Display the MindrianOS De Stijl Mondrian banner + the owned-emotion tagline (D-02 per Phase 115).

## What to do

Run the banner script. It auto-reads the version from plugin.json -- no arguments needed. The banner now stamps the running version of record at the top per Phase 121.5-05 Sub-plan F (SEED-007 absorption); ensure the response shows the banner output verbatim so the user sees "MindrianOS v<version>" without typing `claude plugin list`:

```bash
bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/banner"
```

The first line of the banner output is the canonical version stamp -- format `MindrianOS v<version>`, sourced from `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/first-touch-version-stamper.cjs` (`stampVersion('splash')` returns the long form `MindrianOS v<version> -- conversation as the product surface` if you need to echo the stamp in prose).

After the banner renders, print the owned-emotion tagline on its own line, verbatim (this is `lib/copy/115-spec-strings.cjs` SPLASH_COPY -- do NOT paraphrase per Pitfall 1):

> Stuck on a decision you can't name? Let's find the shape of it.

The banner remains visual. The tagline is the conversation invitation -- one line, no command list, no follow-up prose. Per Canon Part 10 sub-claim 2 ("Conversation IS the surface"), the next move belongs to the user, not to a command menu.

After printing the tagline, say nothing else. Let the line do its work.
