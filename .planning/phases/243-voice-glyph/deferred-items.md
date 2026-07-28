# Phase 243 -- Deferred Items (out of scope, not fixed)

Logged per the executor's SCOPE BOUNDARY rule: pre-existing failures in files
outside this plan's `files_modified` list are not auto-fixed, only recorded.

## Pre-existing baseline failures in `tests/run-all-192.sh` and `tests/run-all-210.sh`

Confirmed present BEFORE any Phase 243 code change (verified by running both
aggregators immediately after adding only the two new, untouched-elsewhere
files `tests/test-243-voice-glyph-honest.cjs` and `tests/run-all-243.sh`, with
`git status --porcelain` showing zero other changes at that point):

- `bash tests/run-all-192.sh` -> PASS=12 FAIL=1. The failure is
  `192-01 menu-sweep live selectors`, assertion B: "help.md/mos.md compliance
  -- help.md still names the two-axis lanes-as-tabs model". File: `help.md` /
  `mos.md`. Zero relation to `lib/statusline/cockpit-renderer.cjs` or the
  voice-glyph vocabulary.
- `bash tests/run-all-210.sh` -> PASS=12 FAIL=2. Failures:
  - `210-D fusion-router suite`, Test 4: `AssertionError [ERR_ASSERTION]: both
    cross-frame edges written` (expected `['ELEVATES_TO', 'SHARES_JOB']`, got
    `[]`) in `tests/test-205-fusion-router.cjs`. Graph/Neo4j-edge-write
    concern, unrelated to the statusline renderer.
  - `210-E3 stamp sweep clean (--check)`: `stamp-firing-block --check: 3
    file(s) pending: eureka.md, find-analogies.md, qualify-opportunity.md`.
    Command frontmatter stamping, unrelated to the voice glyph.

These three failures sit entirely outside Phase 243's declared
`files_modified` (`lib/statusline/cockpit-renderer.cjs`,
`tests/test-voice-glyph-advisory.cjs`, `tests/test-192-statusline-stance-chip.cjs`,
`tests/test-243-voice-glyph-honest.cjs`, `tests/run-all-243.sh`). Fixing them
would require editing `help.md`/`mos.md`, `tests/test-205-fusion-router.cjs`
or its production counterpart, and running `node scripts/stamp-firing-block.cjs`
against three unrelated command files -- none of which this plan touches or is
scoped to touch. Matches the plan's own "File-handling note" section, which
already anticipates pre-existing drift from a concurrent session and instructs
the executor not to mis-attribute it to Phase 243.

**What Phase 243 verifies instead, to satisfy the intent of the plan's
verification gate:** the specific sub-tests these two aggregators carry FOR
Phase 243's own contract -- `tests/test-voice-glyph-advisory.cjs` (leg 3,
inverted) and `tests/test-192-statusline-stance-chip.cjs` (cases b/c,
inverted) -- both pass 100% both standalone (`node tests/test-*.cjs`, exit 0)
and inside the full aggregator run (visible as `PASSED` lines within the
`bash tests/run-all-192.sh` / `bash tests/run-all-210.sh` output). The
aggregators' own exit codes stay non-zero throughout, for the three reasons
above, both before and after this plan's changes -- i.e. Phase 243 introduces
zero new failures and closes zero pre-existing ones. This is recorded honestly
in `243-01-SUMMARY.md` rather than silently claimed as a passing gate.
