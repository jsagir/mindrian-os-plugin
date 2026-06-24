'use strict';
/*
 * Phase 179-05 Wave 5 aggregator loader.
 *
 * tests/run-all-179.sh keys the Wave-5 suite off this aggregator-named file
 * (a run_if file-existence guard). The canonical assertions live in
 * tests/test-abstraction-gate.cjs (used by the plan's <verify>). This thin
 * loader require()s it so the phase aggregator un-SKIPs Wave 5 and flips it to
 * PASS without duplicating any assertion.
 *
 * NO em-dashes anywhere in this file. Hyphens only.
 */
require('./test-abstraction-gate.cjs');
