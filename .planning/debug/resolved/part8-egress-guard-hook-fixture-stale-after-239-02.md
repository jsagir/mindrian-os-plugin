---
kind: rca
status: resolved
owner: 239-04
filed: 2026-07-30
resolved: 2026-07-30
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

## Resolution (239-04, 2026-07-30)

Fixed in `tests/part8-egress-guard-hook.test.cjs`. Root cause confirmed exactly as filed: the
hook script (`scripts/part8-egress-guard-hook.cjs`) calls `sanitizer.isBrainTool(toolName)`
BEFORE ever calling `classify()`, so a `tool_name` fixture that fails `isBrainTool` never reaches
the classifier at all -- the hook `allow()`s (exit 0) before the CONTENT-SET scan runs. The
fixture's `tool_name: 'mcp__brain_query'` was the dead bare-prefix literal `isBrainTool` no
longer recognizes once 239-02 anchored it to `BRAIN_TOOL_MATCHER`.

**Fix:** every `tool_name` fixture that is meant to be recognized as the live Brain door is now
DERIVED at run time from `scripts/check-brain-tool-liveness.cjs`'s `enumerateLiveBrainTools()` +
`composeScopedNames()` (a live plugin-scoped name for `CONTENT_SET`/`CLEAN_MOVE_SET`, a live
plugin-scoped name containing `brain_ask` for `AMBIGUOUS`), never hand-typed -- per
239-RESEARCH.md Pitfall 5's remedy and this plan's own bare-vs-scoped decision rule (a HOOK test
uses the SCOPED form; an in-process `classify()` test uses the BARE form). A threat-T3 negative
case was added alongside it (a foreign server name passes through before `classify()` ever runs).

**Verified after the fix, not just claimed:**
- `node tests/part8-egress-guard-hook.test.cjs` exits 0, PB8-04/05/07/08 + T3 all green.
- `bash tests/run-all-196.sh` -- Passed 5, Failed 0, Skipped 0 (was Passed 4, Failed 1).
- Mutation proof: reverted `isBrainTool` in `lib/core/brain-response-sanitize.cjs` to the
  pre-239 bare-prefix body, re-ran the hook test, observed the EXACT SAME failure this RCA
  originally reported (`PB8-04: CONTENT-SET on a Brain tool must exit 2 (block)`, `0 !== 2`),
  restored the file byte-identical (`git diff --stat` empty), re-ran green.

Full details in `.planning/phases/239-brain-access-surface/239-04-SUMMARY.md`.
