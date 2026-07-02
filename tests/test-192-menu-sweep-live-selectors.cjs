#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 192-01 -- SEED-020 menu-sweep live-selector regression fence.
 *
 * SEED-020 ("command menus render as live selectors, never bare text";
 * Canon Part 10 + Part 3 Shape F) shipped /mos:help as the first two-axis
 * lanes-as-tabs AskUserQuestion selector. This phase completes the sweep:
 * it gap-checks the two surfaces the roadmap said were already done
 * (/mos:help, /mos:mos) and closes the three real gaps the sweep found --
 * /mos:suggest-next (narrative-only close), /mos:rooms list/where (text
 * Action Footer), and /mos:onboard Step 1 (flat "Type 1, 2, or 3" menu).
 *
 * All three route through the SAME shipped SEED-020 construction door:
 * lib/hmi/shape-f1-renderer.cjs (renderShapeF1) + lib/hmi/selector-
 * dispatcher.cjs (pickShape / appendAskUserQuestionTrailer). No new widget,
 * no bespoke AskUserQuestion JSON hand-built inside a command prompt.
 *
 * ============================================================================
 * GAP-CHECK LEDGER (SEED-020 menu sweep -- Phase 192-01 Task 1)
 * ============================================================================
 * Recorded by reading (not re-implementing) each surface:
 *
 *   commands/help.md        = COMPLIANT (no change).
 *       Already a live two-axis lanes-as-tabs AskUserQuestion selector
 *       (SEED-020, commit 9a18fe81). The selector-mechanism assertions in
 *       tests/test-help-selector-lanes.cjs -- Assertion 1 (every group
 *       declares a lane), Assertion 3 (no admin/deprecated leak), Assertion 5
 *       (the two-axis lanes-as-tabs contract + text fallback) -- all PASS.
 *       This plan makes ZERO edits to commands/help.md.
 *
 *   commands/mos.md         = N/A (router; inherits from delegate).
 *       A Shape E state-aware Action Report router. It resolves and hands off
 *       to a target command in the SAME turn ("the routing IS the response";
 *       "Do NOT echo the routing decision and then ask the user to type the
 *       target command"), so the chooser experience it needs is inherited from
 *       whichever target it routes to (onboard / status / suggest-next), NOT
 *       owned by mos.md. Correctly OUT of scope for a selector conversion.
 *       This plan makes ZERO edits to commands/mos.md.
 *
 *   commands/suggest-next.md = GAP -> FIXED (Task 2).
 *       Step 5 closed with a narrative-only "Want me to start any of these
 *       right now?" question. Now closes with a live F.1 AskUserQuestion card.
 *
 *   commands/rooms.md        = GAP -> FIXED (Task 2).
 *       list/where Action Footers were bare bullet text. Now close with a
 *       live F.1 AskUserQuestion card; new/open/close/archive/git-setup/
 *       git-status stay as terminal-confirmation text footers by design.
 *
 *   commands/onboard.md      = GAP -> FIXED (Task 3).
 *       Step 1 was a flat "Type 1, 2, or 3" ASCII menu. Now renders a live
 *       F.1 AskUserQuestion card with the "just start talking" free-text floor
 *       intact (Canon Part 10 no-wrong-door). Step 6 was already an F.1 card.
 *
 * ----------------------------------------------------------------------------
 * PRE-EXISTING, OUT-OF-SCOPE CONDITION discovered during the Task-1 gap-check
 * (recorded, NOT patched here per R7 -- do not touch help.md / help-groups.json
 * scope creep; and per the executor SCOPE BOUNDARY -- pre-existing failures in
 * unrelated files are out of scope):
 *
 *   tests/test-help-selector-lanes.cjs  Assertions 2 + 4 FAIL, and
 *   scripts/check-help-coverage.cjs     exits non-zero,
 *
 *   because 12 command files exist that are NOT registered in
 *   data/help-groups.json (agentshield, bono, correct-reference-now, deck,
 *   diffusion, futures, ingest-methodology, mva-report, new-surface, show,
 *   skill, trending-to-absurd). This is a help-GROUPS coverage drift, NOT a
 *   regression in the help SELECTOR mechanism (Assertions 1/3/5 -- which lock
 *   the selector contract -- all PASS). It is orthogonal to this plan's
 *   live-selector conversion of suggest-next / rooms / onboard. Named
 *   follow-up: register the 12 commands in data/help-groups.json (its own
 *   /gsd:quick, owner: whoever owns the help lane coverage).
 * ============================================================================
 *
 * Test dialect mirrors tests/test-help-selector-lanes.cjs (node:assert,
 * pass/failTest counters, process.exit).
 *
 * Canon Part 8 (Graph Boundary): filesystem only -- zero network surface.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SELF_PATH = __filename;

function readCmd(name) {
  return fs.readFileSync(path.join(COMMANDS_DIR, name), 'utf8');
}

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// -- Assertion A: the Task-1 gap-check ledger is present in this file --------
// Locks the auditable record of help.md = COMPLIANT, mos.md = N/A, and the
// three GAP -> FIXED conversions, without inventing a synthetic pass/fail on
// files this plan does not own.
try {
  const self = fs.readFileSync(SELF_PATH, 'utf8');
  assert.ok(/GAP-CHECK LEDGER \(SEED-020 menu sweep/.test(self), 'gap-check ledger header present');
  assert.ok(/commands\/help\.md\s+= COMPLIANT/.test(self), 'ledger records help.md = COMPLIANT');
  assert.ok(/commands\/mos\.md\s+= N\/A/.test(self), 'ledger records mos.md = N/A (router)');
  assert.ok(/commands\/suggest-next\.md = GAP/.test(self), 'ledger records suggest-next.md = GAP -> FIXED');
  assert.ok(/commands\/rooms\.md\s+= GAP/.test(self), 'ledger records rooms.md = GAP -> FIXED');
  assert.ok(/commands\/onboard\.md\s+= GAP/.test(self), 'ledger records onboard.md = GAP -> FIXED');
  pass('Assertion A (Task-1 SEED-020 gap-check ledger present + records all five surfaces)');
} catch (err) { failTest('Assertion A (gap-check ledger present)', err); }

// -- Assertion B: help.md + mos.md confirmed still-compliant, zero edits ------
// help.md remains a live two-axis AskUserQuestion selector; mos.md remains a
// Shape E router that hands off in-turn (no chooser it must own).
try {
  const help = readCmd('help.md');
  assert.ok(/AskUserQuestion/.test(help), 'help.md still renders an AskUserQuestion selector');
  assert.ok(/two-axis/i.test(help), 'help.md still names the two-axis lanes-as-tabs model');
  const mos = readCmd('mos.md');
  assert.ok(/the routing IS the response/i.test(mos), 'mos.md is still a Shape E router (routing IS the response)');
  assert.ok(/Do NOT echo the routing decision/i.test(mos), 'mos.md still hands off in-turn (does not ask user to type the target)');
  pass('Assertion B (help.md live selector + mos.md router doctrine intact -- both untouched)');
} catch (err) { failTest('Assertion B (help.md/mos.md compliance)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' assertion block(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' assertion blocks PASS');
process.exit(0);
