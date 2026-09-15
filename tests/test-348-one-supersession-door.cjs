'use strict';
/*
 * tests/test-348-one-supersession-door.cjs -- Phase 348-02 Task 3: the
 * SUPER-01 source tripwire. Green today and for the rest of the phase.
 *
 * docs/SUPERSESSION-CONTRACT.md ("The one door", SUPER-01): "supersede() is
 * the only supersession writer in the repo... A source tripwire enforces
 * this mechanically: it asserts no code outside
 * lib/core/navigation/transitions.cjs::promoteNodeStatus sets review_status
 * to 'superseded', and that no surface this phase ships issues a DELETE
 * against nodes or edges." This file IS that tripwire.
 *
 * Comment-stripping is MANDATORY and happens BEFORE any assertion runs:
 * lib/core/temporal/supersession.cjs's own header names review_status /
 * 'superseded' in the prose EXPLAINING what the module does
 * ("A.review_status = 'superseded'," is a comment, not code), and
 * lib/core/navigation/transitions.cjs's own comments do the same. An
 * unstripped scan would be self-invalidating: it would find the very words
 * it is checking for inside a comment that is explaining, not writing.
 * Strip first, then scan the code that is actually left. Mirrors
 * tests/test-346-no-second-brain.cjs's own stripComments idiom verbatim.
 *
 * SCOPE NOTE on assertions 2 and 3 (read before editing this file): the
 * production tree carries pre-existing, OUT-OF-PHASE raw
 * `UPDATE nodes SET review_status = 'confirmed'` writers
 * (lib/core/navigation/grant-rubric.cjs, typed-frame.cjs, typed-domain.cjs,
 * room-birth.cjs) that bypass the transitions.cjs chokepoint for the
 * CONFIRMED status. Those are real, but they are Phase 348's own
 * SUPERSESSION-CONTRACT.md text scopes this tripwire to the 'superseded'
 * value specifically ("nothing outside promoteNodeStatus writes
 * review_status superseded" -- the must_haves truth this test proves), not a
 * general review_status write audit (a separate, out-of-scope finding this
 * plan does not adopt as its own -- Rule "scope boundary": only auto-fix or
 * assert on what THIS task's own files/claims touch). Assertions 2 and 3
 * below are therefore scoped to the literal 'superseded' value, matching the
 * contract's own wording exactly.
 *
 * ALLOW-LIST NOTE: the plan's own Task 3 action text names three allow-list
 * members for assertion 2 (transitions.cjs, node-insert.cjs,
 * phase-109-nodes-provenance.cjs). This file adds a fourth,
 * lib/core/temporal/supersession.cjs, because assertion 1 below already
 * proves it is the repo's ONE authorized supersede() writer, and it
 * necessarily carries the literal 'superseded' as the toStatus argument to
 * the transitions.cjs chokepoint call it makes (supersession.cjs:103).
 * Omitting it would make this very tripwire fail against the phase's own
 * central module, which SUPER-01's own text does not intend: it names ONE
 * forbidden DIRECT writer, not a caller that legally invokes the one real
 * writer through the chokepoint.
 *
 * Colocated unit-test files (*.test.cjs / *.test.js, e.g.
 * lib/core/temporal/supersession.test.cjs) live UNDER lib/ in this repo but
 * are tests, not production writers -- excluded from the scan on the same
 * "excluding tests/" principle the plan's own action text states, just
 * applied to this repo's colocated-test convention rather than only the
 * top-level tests/ directory.
 *
 * House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`
 * counter, final line '>>> test-348-one-supersession-door.cjs: PASSED'.
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

let n = 0;
function ok(desc, fn) {
  fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

console.log('test-348-one-supersession-door (SUPER-01)');

/**
 * Strip block comments then line comments. Order matters: stripping block
 * comments first prevents a `//` inside a `/* ... *\/` block from being
 * mistaken for a line comment start after the block is gone, and stripping
 * line comments second catches anything a block-comment removal exposed.
 * Mirrors tests/test-346-no-second-brain.cjs::stripComments verbatim.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLines = noBlocks.replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
  return noLines;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

// The production-tree roots this scan sweeps. tests/ and node_modules/ are
// never walked at all (not merely filtered), matching the plan's own scope.
const SCAN_ROOTS = ['lib', 'commands', 'scripts', 'agents', 'skills', 'hooks'];
const SCAN_EXTENSIONS = new Set(['.cjs', '.js']);
const TEST_FILENAME_RE = /\.test\.(cjs|js)$/;

function walkFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkFiles(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext) && !TEST_FILENAME_RE.test(entry.name)) {
        results.push(full);
      }
    }
  }
  return results;
}

const files = [];
for (const root of SCAN_ROOTS) {
  files.push(...walkFiles(path.join(REPO, root)));
}

// Read + strip every scanned file exactly once; every assertion below reuses
// this same map.
const strippedByFile = new Map();
for (const f of files) {
  let raw;
  try {
    raw = fs.readFileSync(f, 'utf8');
  } catch (_e) {
    continue;
  }
  strippedByFile.set(f, stripComments(raw));
}

// ---- Assertion 1: exactly one exporting file, by path equality ----------

ok('exactly one file exports a function named supersede, and it is lib/core/temporal/supersession.cjs', function () {
  const DECL_RE = /\b(?:function\s+supersede\s*\(|(?:const|let|var)\s+supersede\s*=)/;
  const writers = [];
  for (const [file, stripped] of strippedByFile) {
    if (DECL_RE.test(stripped)) writers.push(toPosix(path.relative(REPO, file)));
  }
  assert.equal(writers.length, 1, 'expected exactly one supersede() writer, found: ' + JSON.stringify(writers));
  assert.equal(writers[0], 'lib/core/temporal/supersession.cjs');
});

// ---- Assertion 2: one status setter, a named allow-list ------------------

const STATUS_SETTER_ALLOW_LIST = Object.freeze([
  'lib/core/navigation/transitions.cjs',
  'lib/core/node-insert.cjs',
  'lib/core/migrations/phase-109-nodes-provenance.cjs',
  'lib/core/temporal/supersession.cjs',
]);

ok("the set of files carrying the 'superseded' review_status literal is a subset of the named allow-list", function () {
  const SUPERSEDED_LITERAL_RE = /['"]superseded['"]/;
  const REVIEW_STATUS_RE = /review_status/i;
  const hits = [];
  for (const [file, stripped] of strippedByFile) {
    const lines = stripped.split('\n');
    let found = false;
    for (let i = 0; i < lines.length && !found; i += 1) {
      if (!SUPERSEDED_LITERAL_RE.test(lines[i])) continue;
      const windowStart = Math.max(0, i - 3);
      const windowEnd = Math.min(lines.length, i + 4);
      const window = lines.slice(windowStart, windowEnd).join('\n');
      if (REVIEW_STATUS_RE.test(window)) found = true;
    }
    if (found) hits.push(toPosix(path.relative(REPO, file)));
  }
  const unexpected = hits.filter(function (h) { return STATUS_SETTER_ALLOW_LIST.indexOf(h) === -1; });
  assert.deepEqual(
    unexpected, [],
    'files outside the allow-list carry the superseded review_status literal. Full set found: '
    + JSON.stringify(hits) + '. Allow-list: ' + JSON.stringify(STATUS_SETTER_ALLOW_LIST)
    + '. Unexpected: ' + JSON.stringify(unexpected)
  );
});

// ---- Assertion 3: no second hardcoded UPDATE ------------------------------

ok("zero hardcoded \"UPDATE nodes SET review_status = 'superseded'\" writes outside transitions.cjs", function () {
  const HARDCODED_UPDATE_RE = /update\s+nodes\s+set\s+review_status\s*=\s*['"]superseded['"]/i;
  const CHOKEPOINT = 'lib/core/navigation/transitions.cjs';
  const violations = [];
  for (const [file, stripped] of strippedByFile) {
    const rel = toPosix(path.relative(REPO, file));
    if (rel === CHOKEPOINT) continue;
    const normalized = stripped.replace(/\s+/g, ' ').trim();
    if (HARDCODED_UPDATE_RE.test(normalized)) violations.push(rel);
  }
  assert.deepEqual(violations, [], 'hardcoded superseded UPDATE found outside the chokepoint: ' + JSON.stringify(violations));
});

// ---- Assertion 4: no DELETE on this phase's own named surfaces -----------
// The surface list is read live off tests/run-all-348.sh's own
// PHASE_348_SURFACES array, never re-typed here, so the two lists cannot
// drift apart.

ok('zero DELETE FROM nodes / DELETE FROM edges on any file named in run-all-348.sh PHASE_348_SURFACES', function () {
  const aggregatorPath = path.join(REPO, 'tests', 'run-all-348.sh');
  const aggregatorSrc = fs.readFileSync(aggregatorPath, 'utf8');
  const arrayMatch = aggregatorSrc.match(/PHASE_348_SURFACES=\(([\s\S]*?)\)/);
  assert.ok(arrayMatch, 'could not locate PHASE_348_SURFACES array in tests/run-all-348.sh');
  const surfaceLines = arrayMatch[1].match(/"([^"]+)"/g) || [];
  const surfaces = surfaceLines.map(function (s) { return s.slice(1, -1); });
  assert.ok(surfaces.length > 0, 'PHASE_348_SURFACES parsed empty');

  const DELETE_RE = /delete\s+from\s+(?:nodes|edges)/i;
  const violations = [];
  for (const rel of surfaces) {
    const full = path.join(REPO, rel);
    if (!fs.existsSync(full)) continue; // not landed yet -- nothing to scan
    let raw;
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch (_e) {
      continue;
    }
    const stripped = /\.(cjs|js)$/.test(rel) ? stripComments(raw) : raw;
    if (DELETE_RE.test(stripped)) violations.push(rel);
  }
  assert.deepEqual(violations, [], 'DELETE FROM nodes/edges found on a named phase surface: ' + JSON.stringify(violations));
});

// ---- Assertion 5: the one live caller, named -----------------------------
// WD-348-6: lib/core/close-loop-writer.cjs is the ONLY live caller of
// supersede() today, reached through its injectable supersedeFn seam, and it
// supplies no byUser -- defaulting to 'system' -- so after 348-03 lands the
// widened human-attribution guard, this call site is refused rather than
// silently permitted (it has produced zero SUPERSEDES edges in 47 live rooms
// either way, per docs/SUPERSESSION-CONTRACT.md's measured census).

ok('lib/core/close-loop-writer.cjs requires supersession.cjs directly and reaches supersede via supersedeFn', function () {
  const callerPath = path.join(REPO, 'lib', 'core', 'close-loop-writer.cjs');
  const stripped = stripComments(fs.readFileSync(callerPath, 'utf8'));
  assert.ok(
    /require\(\s*['"]\.\/temporal\/supersession\.cjs['"]\s*\)/.test(stripped),
    'close-loop-writer.cjs must require ./temporal/supersession.cjs directly'
  );
  assert.ok(
    /supersedeFn\s*=\s*typeof\s+options\.supersedeFn\s*===\s*['"]function['"]\s*\?\s*options\.supersedeFn\s*:\s*supersession\.supersede/.test(stripped),
    'close-loop-writer.cjs must reach supersede through an injectable supersedeFn seam defaulting to supersession.supersede'
  );
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-one-supersession-door.cjs: PASSED');
process.exit(0);
