---
quick_id: 261126-ter
type: quick
wave: 1
depends_on: []
files_modified: [tests/test-400.4-card-descriptions.cjs, tests/test-374-engine-busy.cjs]
autonomous: true
---

# Quick 261126-ter: fix the two release-gate test failures Phase 400.4 caused on main

Reported by session jsagi-b3 on main (both in run-all-366, which is in the release gate).

<task id="1">
<name>Replace the literal dash characters in the card-descriptions test regex</name>
<read_first>tests/test-400.4-card-descriptions.cjs (line 70), tests/test-389-renames.cjs (Test 6)</read_first>
<action>In tests/test-400.4-card-descriptions.cjs line 70, replace the literal U+2013 and U+2014 characters inside the regex `/[0-9–—]/` with the escapes `–` and `—`, so the assertion matches the same characters and the file holds no dash character.</action>
<acceptance_criteria>
- `grep -cP "[\x{2013}\x{2014}]" tests/test-400.4-card-descriptions.cjs` prints 0
- `node tests/test-400.4-card-descriptions.cjs` exits 0
- `node tests/test-389-renames.cjs` Test 6 passes
</acceptance_criteria>
</task>

<task id="2">
<name>Re-pin the test-270 budget line in test-374 B9 with a reason</name>
<read_first>tests/test-374-engine-busy.cjs (B9 near line 440, BASELINE_BUDGET_LINE), tests/test-270-tool-schema-budget.cjs</read_first>
<action>Run `node tests/test-270-tool-schema-budget.cjs` and copy its exact `budget:` line. First confirm B9's job-tool fingerprint assert still passes (only the budget line differs); if the fingerprint also differs, stop and report. Set BASELINE_BUDGET_LINE to the new line and add a comment: re-pinned by quick 261126-ter after Phase 400.4 plans 03 (context_assemble cortex_k parameter and description sentence), 05 (whitespace_scan description sentence) and 06 (eureka_graph_project description sentence) grew the tool descriptions; the five job tools are unchanged.</action>
<acceptance_criteria>
- `node tests/test-374-engine-busy.cjs` exits 0 (B9 passes)
- the comment names 400.4 plans 03, 05, 06 and the three tools
</acceptance_criteria>
</task>

<verification>
Run with HOME and MINDRIAN_ROOMS_HOME set to temp dirs and stdin /dev/null: the three tests above, then `bash tests/run-all-366.sh`; record any failing line and whether it fails on plain origin/main too.
</verification>
