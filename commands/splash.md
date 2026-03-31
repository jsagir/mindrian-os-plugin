---
name: splash
description: Display the MindrianOS Mondrian banner
body_shape: raw
---

# /mos:splash

Display the MindrianOS De Stijl Mondrian banner on demand.

## What to do

Run the banner script. It auto-reads the version from plugin.json -- no arguments needed:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/banner"
```

The banner is purely visual -- no context injection, no state changes, no room modifications.

After showing the banner, say nothing else. Let the art speak.
