'use strict';
/*
 * Phase 179-07 Wave 7 (FINAL) aggregator loader.
 *
 * tests/run-all-179.sh keys the Wave-7 suite off this aggregator-named file
 * (a run_if file-existence guard). The canonical assertions live in
 * tests/test-b1-reconcile-canonical.cjs (used by the plan's <verify>): the
 * reconcile-the-two-B1-specs proof + the cross-cutting Part 8 leak sweep + the
 * CIRS born-wired conformance check. This thin loader require()s it so the phase
 * aggregator un-SKIPs Wave 7 and flips it to PASS without duplicating any
 * assertion. Mirrors the Wave-6 test-cv-multiselect-179.cjs loader idiom verbatim.
 *
 * NO em-dashes anywhere in this file. Hyphens only.
 */
require('./test-b1-reconcile-canonical.cjs');
