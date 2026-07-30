---
kind: rca
status: open
owner: 239-04
filed: 2026-07-30
---

# tests/part8-egress-guard-hook.test.cjs PB8-04 fails after 239-02's real fix

**Not a regression from 239-02.** 239-02 made `isBrainTool`/`BRAIN_TOOL_MATCHER` the single
authority derived from live Brain tool names, replacing the dead `mcp__brain_.*` literal.
`tests/part8-egress-guard-hook.test.cjs:78` (PB8-04) still fixtures that dead literal, so its
CONTENT-SET-on-a-Brain-tool case no longer matches and the hook correctly no-ops (exit 0
instead of the asserted exit 2).

This file is already inside Phase 239 Plan 04's declared `files_modified` scope. 239-02's own
executor found and documented this live during Wave 2 (see 239-02-SUMMARY.md) and deliberately
did not touch it, per the cross-plan file-ownership fence. 239-04 (Wave 4) fixes the fixture to
use a live Brain tool name.

**Verified before deferring, not just claimed:** `bash tests/run-all-196.sh` -- Passed 4, Failed 1
(PB8-04/05/07/08), confirmed the SAME single assertion (`0 !== 2` at line 78) both before and
after Wave 2's merge; no other leg regressed.
