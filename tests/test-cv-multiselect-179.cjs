'use strict';
/*
 * Phase 179-06 Wave 6 aggregator loader.
 *
 * tests/run-all-179.sh keys the Wave-6 suite off this aggregator-named file
 * (a run_if file-existence guard). The canonical assertions live in
 * tests/test-cv-multiselect-and-engine1.cjs (used by the plan's <verify>). This
 * thin loader require()s it so the phase aggregator un-SKIPs Wave 6 and flips it
 * to PASS without duplicating any assertion. Mirrors the Wave-5
 * test-abstraction-gate-179.cjs loader idiom verbatim.
 *
 * NO em-dashes anywhere in this file. Hyphens only.
 */
require('./test-cv-multiselect-and-engine1.cjs');
