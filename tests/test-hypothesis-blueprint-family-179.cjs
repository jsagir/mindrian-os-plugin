'use strict';
// Phase 179-04 (Wave 4) -- aggregator entry point for the hypothesis family +
// truth-claim filing + per-role Door 3 framing proof. tests/run-all-179.sh keys
// the Wave-4 suite off this filename; the assertions live in the canonical
// tests/test-hypothesis-family-and-claim.cjs (the plan-named suite). This thin
// loader keeps the aggregator un-SKIP without duplicating the assertions.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).
require('./test-hypothesis-family-and-claim.cjs');
