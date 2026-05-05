---
name: splash
description: Display the MindrianOS Mondrian banner
body_shape: raw
serves_jtbd: ["explore"]
allowed-tools:
  - Bash
---

# /mos:splash

Display the MindrianOS De Stijl Mondrian banner + the owned-emotion tagline (D-02 per Phase 115).

## What to do

Run the banner script. It auto-reads the version from plugin.json -- no arguments needed:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/banner"
```

After the banner renders, print the owned-emotion tagline on its own line, verbatim (this is `lib/copy/115-spec-strings.cjs` SPLASH_COPY -- do NOT paraphrase per Pitfall 1):

> Stuck on a decision you can't name? Let's find the shape of it.

The banner remains visual. The tagline is the conversation invitation -- one line, no command list, no follow-up prose. Per Canon Part 10 sub-claim 2 ("Conversation IS the surface"), the next move belongs to the user, not to a command menu.

After printing the tagline, say nothing else. Let the line do its work.
