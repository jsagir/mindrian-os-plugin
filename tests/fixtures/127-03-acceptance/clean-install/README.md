# Fixture: clean-install (acceptance gate 1)

Hermetic state: fresh `HOME=$TMPDIR`, no `~/.mindrian.env`, no `claude mcp add` history, MINDRIAN_BRAIN_KEY unset.

Expected behavior: shim loads, every Brain tool call returns the canonical Tier-0 sentinel (`status: "DIRECTOR_NOT_AVAILABLE"`). Doctor Class-M reports L1 PASS, L2 FAIL, L3-L5 skipped.

This is the canonical "Tier-0 cohort" experience for a user who installs the plugin and has not yet provided a key.
