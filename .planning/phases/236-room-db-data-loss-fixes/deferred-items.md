# Deferred items - Phase 236

## Pre-existing, out of scope for 236-03

- `tests/test-graph-derivation-verdict.cjs` fails 2 assertions at HEAD (commit 1de288e1), BEFORE any 236-03 change:
  `GDH-09 born-like: a FEYNMAN body carries the ## Timeline (auto) section` and the same assertion at
  `D-169-11 depth>=2`. Verified by restoring both 236-03 source files to HEAD and re-running: byte-identical
  failure output. Unrelated to room.db open classification (it is a markdown FEYNMAN/Timeline section concern).
  NOT fixed here per the executor scope boundary. Needs its own investigation.
