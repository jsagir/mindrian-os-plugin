#!/usr/bin/env node
// Phase 265 Plan 14 (RADAR-21) tripwire -- protects the four properties that
// make commands/mos-reason.md's hybrid dispatch protocol safe: the migration
// backup runs before any subagent is dispatched, the four Feynman prompts
// are never inlined a third time, the cross-section coherence check exists
// and follows dispatch, and the corrected 265-03 dispatch idiom (explicit
// subagent_type, no run_in_background, the 20-cap) has not regressed in this
// file specifically.
//
// This test does NOT own prompt byte-equality -- that is
// lib/memory/feynman-prompts-drift.test.cjs's job, and arm 2 below only
// counts sentinel occurrences and checks for the dispatch-time read; it never
// re-derives or duplicates the character-by-character comparison that test
// already owns.
//
// Plain Node script, no node:test, no npm deps. Hyphens only (no em-dashes).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'commands', 'mos-reason.md');

let failed = false;
let passCount = 0;
let failCount = 0;

function pass(label) {
  passCount += 1;
  console.log('PASS: ' + label);
}

function fail(label) {
  failed = true;
  failCount += 1;
  console.error('FAIL: ' + label);
}

if (!fs.existsSync(TARGET)) {
  console.error('FAIL: commands/mos-reason.md does not exist -- nothing to check');
  process.exit(1);
}

const text = fs.readFileSync(TARGET, 'utf8');

// ---------------------------------------------------------------------------
// ARM 1: ORDERING GUARD. The migration backup invocation must appear before
// the parallel-dispatch status block in byte order. Fanning out before the
// `.migration-backup/` tree exists means a subagent can overwrite a
// pre-migration MINTO.md with no recovery path (T-265-60).
// ---------------------------------------------------------------------------
(function armOrderingGuard() {
  const backupIdx = text.indexOf('vault-regenerate-all.cjs');
  const dispatchIdx = text.indexOf('Dispatching');

  if (backupIdx === -1) {
    fail(
      'ARM 1 (ordering guard): "vault-regenerate-all.cjs" not found in commands/mos-reason.md -- ' +
        'the migration backup invocation is missing entirely, so the ordering it guards cannot be proven'
    );
    return;
  }
  if (dispatchIdx === -1) {
    fail(
      'ARM 1 (ordering guard): "Dispatching" not found in commands/mos-reason.md -- ' +
        'the parallel fan-out status block is missing entirely'
    );
    return;
  }
  if (!(backupIdx < dispatchIdx)) {
    fail(
      'ARM 1 (ordering guard): "vault-regenerate-all.cjs" (offset ' +
        backupIdx +
        ') does not precede "Dispatching" (offset ' +
        dispatchIdx +
        '). Consequence: fanning out before the .migration-backup/ tree exists ' +
        'means a subagent can overwrite a pre-migration MINTO.md with no recovery path.'
    );
    return;
  }
  pass('ARM 1 -- migration backup (offset ' + backupIdx + ') precedes dispatch (offset ' + dispatchIdx + ')');
})();

// ---------------------------------------------------------------------------
// ARM 2: NO-THIRD-COPY. Each Feynman stage sentinel must appear exactly once,
// and the file must name lib/memory/feynman-prompts.cjs at least once (the
// dispatch-time read). The natural way to write a subagent prompt is to
// paste the prompt text in; that would either break
// lib/memory/feynman-prompts-drift.test.cjs's byte-equality check or force it
// to grow a third arm it was never designed to own.
// ---------------------------------------------------------------------------
(function armNoThirdCopy() {
  const stages = ['STAGE_1_ESSENCE', 'STAGE_2_PLAIN_LANGUAGE', 'STAGE_4_MENTAL_MODEL', 'STAGE_5_SWEET_SPOT'];
  let stagesOk = true;
  for (const stage of stages) {
    const startMarker = '<!-- ' + stage + ' start -->';
    const count = text.split(startMarker).length - 1;
    if (count !== 1) {
      stagesOk = false;
      fail(
        'ARM 2 (no third copy): sentinel "' +
          startMarker +
          '" appears ' +
          count +
          ' time(s), expected exactly 1. A duplicate copy of a Feynman prompt is exactly the ' +
          'drift risk lib/memory/feynman-prompts-drift.test.cjs exists to catch, and a byte-identical ' +
          'duplicate inside THIS file is invisible to that test unless the sentinel count itself is checked.'
      );
    }
  }
  if (!text.includes('lib/memory/feynman-prompts.cjs')) {
    stagesOk = false;
    fail(
      'ARM 2 (no third copy): "lib/memory/feynman-prompts.cjs" is not named anywhere in ' +
        'commands/mos-reason.md -- the dispatch-time read (the whole point of not inlining a ' +
        'third copy into the subagent definition) is missing.'
    );
  }
  if (stagesOk) {
    pass('ARM 2 -- each Feynman stage sentinel appears exactly once, and the library source is named');
  }
})();

// ---------------------------------------------------------------------------
// ARM 3: CONSOLIDATION. The file must name governing_thought, contradiction,
// and compute-hsi.py, and the coherence check's governing_thought occurrence
// must follow the dispatch status block (consolidation happens after
// dispatch, never before). Independent subagents lose the sequential loop's
// accidental cross-section coherence; this arm keeps the explicit
// replacement from silently disappearing in a future edit.
// ---------------------------------------------------------------------------
(function armConsolidation() {
  const dispatchIdx = text.indexOf('Dispatching');
  const hsiIdx = text.indexOf('compute-hsi.py');

  let ok = true;

  if (dispatchIdx === -1) {
    fail('ARM 3 (consolidation): "Dispatching" not found -- cannot locate the dispatch block to order against');
    return;
  }

  // The FIRST "contradiction" occurring AFTER dispatch is the consolidation
  // step's own mention. An earlier occurrence (e.g. in the objective prose
  // explaining WHY the check exists) is a legitimate separate mention and
  // must not be mistaken for the consolidation step itself.
  const contradictionIdx = text.indexOf('contradiction', dispatchIdx);

  if (contradictionIdx === -1) {
    ok = false;
    fail(
      'ARM 3 (consolidation): "contradiction" does not appear anywhere after the dispatch block -- ' +
        'the cross-section coherence check is missing or was written before dispatch instead of after it'
    );
  }
  if (hsiIdx === -1) {
    ok = false;
    fail('ARM 3 (consolidation): "compute-hsi.py" not found -- the post-parallel cascade trigger is missing');
  }
  if (!ok) return;

  // The coherence check's own governing_thought occurrence must sit in the
  // same neighborhood as "contradiction" (the step that compares returned
  // governing_thought values across sections), not merely anywhere earlier
  // in the file (Stage 5's own prompt schema also mentions the term).
  const windowStart = Math.max(0, contradictionIdx - 1500);
  const windowEnd = Math.min(text.length, contradictionIdx + 500);
  const window = text.slice(windowStart, windowEnd);

  if (!window.includes('governing_thought')) {
    fail(
      'ARM 3 (consolidation): no "governing_thought" occurrence found within 1500 chars before ' +
        'and 500 chars after "contradiction" -- the coherence check must compare governing_thought ' +
        'values across sections, not just mention the word "contradiction" in passing.'
    );
    return;
  }

  if (dispatchIdx === -1 || !(dispatchIdx < contradictionIdx)) {
    fail(
      'ARM 3 (consolidation): the coherence check ("contradiction", offset ' +
        contradictionIdx +
        ') does not follow the dispatch status block ("Dispatching", offset ' +
        dispatchIdx +
        '). Independent subagents lose the sequential loop\'s accidental cross-section coherence, ' +
        'so the explicit consolidation-after-dispatch ordering is not optional.'
    );
    return;
  }

  // Report-and-flag, never auto-edit: the consolidation region must state
  // that this is a reporting step, not a silent rewrite.
  const reportsRatherThanEdits =
    /report[- ]and[- ]flag/i.test(window) || (/report/i.test(window) && /never an? auto[- ]edit/i.test(window));
  if (!reportsRatherThanEdits) {
    fail(
      'ARM 3 (consolidation): the coherence check does not state that it reports/flags rather than ' +
        'auto-edits. Expected language near "contradiction" naming this a report-and-flag step.'
    );
    return;
  }

  pass(
    'ARM 3 -- consolidation names governing_thought, contradiction and compute-hsi.py, follows ' +
      'dispatch, and states it reports rather than auto-edits'
  );
})();

// ---------------------------------------------------------------------------
// ARM 4: STALE-IDIOM. Zero occurrences of run_in_background, at least one
// occurrence each of subagent_type and CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS.
// Keeps the corrected 265-03 dispatch idiom from regressing in this file
// specifically, independent of whatever the other swarm commands do.
// ---------------------------------------------------------------------------
(function armStaleIdiom() {
  let ok = true;

  const ribCount = text.split('run_in_background').length - 1;
  if (ribCount !== 0) {
    ok = false;
    fail(
      'ARM 4 (stale idiom): "run_in_background" appears ' +
        ribCount +
        ' time(s) in commands/mos-reason.md. Claude Code removes that Agent-tool parameter ' +
        'entirely under fork mode (the interactive default since 2.1.232); this must be absent, ' +
        'even from prose.'
    );
  }
  if (!text.includes('subagent_type')) {
    ok = false;
    fail('ARM 4 (stale idiom): "subagent_type" not found -- the dispatch instruction must name an explicit type');
  }
  if (!text.includes('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS')) {
    ok = false;
    fail(
      'ARM 4 (stale idiom): "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS" not found -- the 20-cap standing ' +
        'rule must be named even though this fan-out is smaller than the cap'
    );
  }
  if (ok) {
    pass('ARM 4 -- zero run_in_background, subagent_type and the 20-cap env var both present');
  }
})();

console.log('');
console.log(passCount + ' passed, ' + failCount + ' failed (4 arms total)');

if (failed) {
  process.exit(1);
}
process.exit(0);
