---
name: splash
description: Display the MindrianOS Mondrian banner
body_shape: E
serves_jtbd: ["explore"]
teaching: "When you want the MindrianOS Mondrian banner, /mos:splash displays it. Mostly decorative; useful for screenshots and demo openings."
allowed-tools:
  - Bash
---

# /mos:splash

Display the MindrianOS De Stijl Mondrian banner + the owned-emotion tagline (D-02 per Phase 115).

## What to do

Run the banner script. It auto-reads the version from plugin.json -- no arguments needed. The banner now stamps the running version of record at the top per Phase 121.5-05 Sub-plan F (SEED-007 absorption); ensure the response shows the banner output verbatim so the user sees "MindrianOS v<version>" without typing `claude plugin list`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/banner"
```

The first line of the banner output is the canonical version stamp -- format `MindrianOS v<version>`, sourced from `${CLAUDE_PLUGIN_ROOT}/lib/core/first-touch-version-stamper.cjs` (`stampVersion('splash')` returns the long form `MindrianOS v<version> -- conversation as the product surface` if you need to echo the stamp in prose).

After the banner renders, print the owned-emotion tagline on its own line, verbatim (this is `lib/copy/115-spec-strings.cjs` SPLASH_COPY -- do NOT paraphrase per Pitfall 1):

> Stuck on a decision you can't name? Let's find the shape of it.

The banner remains visual. The tagline is the conversation invitation -- one line, no command list, no follow-up prose. Per Canon Part 10 sub-claim 2 ("Conversation IS the surface"), the next move belongs to the user, not to a command menu.

After printing the tagline, say nothing else. Let the line do its work.
