'use strict';
// Phase 124 Wave 0 stub. Plan 124-00 ships this stub; Plan 124-01 replaces it with real assertions.
// Requirement: TEMPORAL-124-04
// Deliverable: empty-state placeholder (a section with zero memory_event rows scoped to its source_section renders exactly `*No timeline events yet.*` between the TIMELINE_AUTO_START / TIMELINE_AUTO_END sentinels and nothing else; cross-section non-leak via D-08 scoping)
// Pattern: matches tests/test-brain-packet-schema-check.cjs (CJS, node:assert, node:child_process; no Mocha, no Jest, zero new npm dependencies).

process.stderr.write('MISSING - Wave 1 must implement the empty-state placeholder test (zero memory_event rows -> "*No timeline events yet.*") (Plan 124-01)\n');
process.exit(1);
