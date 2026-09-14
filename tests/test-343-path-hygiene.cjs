'use strict';
/*
 * Phase 343 Plan 03 -- test-343-path-hygiene.
 *
 * Pins the navigation folder contract, its routing row, the corrected
 * docs/lazygraph-schema.md path, and the five annotated .room-graph
 * skip-list sites. Bare node script, no framework, exits non-zero on
 * failure, self-contained (the test-245-priority-complete.cjs convention).
 *
 * Arm 4 asserts PROXIMITY (an annotation within two lines of the entry it
 * explains), never file-wide presence, so an annotation that drifts away
 * from the .room-graph entry it explains fails the test.
 *
 * WD-16: skip-list MEMBERSHIP is never asserted here. All four skip-lists
 * keep the inert .room-graph entry; removing one changes what four walkers
 * traverse and is out of this plan's scope.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

console.log('test-343-path-hygiene:');

// ---------------------------------------------------------------------------
// Arm 1: the contract exists and answers both walk-test questions.
// ---------------------------------------------------------------------------
const roomMdPath = path.join(ROOT, 'lib/core/navigation/ROOM.md');
const contextMdPath = path.join(ROOT, 'lib/core/navigation/CONTEXT.md');

assert.strictEqual(fs.existsSync(roomMdPath), false, 'lib/core/navigation/ROOM.md must be absent');
ok('lib/core/navigation/ROOM.md is absent');

assert.strictEqual(fs.existsSync(contextMdPath), true, 'lib/core/navigation/CONTEXT.md must exist');
ok('lib/core/navigation/CONTEXT.md exists');

const contextText = fs.readFileSync(contextMdPath, 'utf8');
const contextLineCount = contextText.split('\n').length;
assert.ok(
  contextLineCount >= 60 && contextLineCount <= 100,
  'CONTEXT.md line count ' + contextLineCount + ' must be between 60 and 100 inclusive'
);
ok('CONTEXT.md line count (' + contextLineCount + ') is between 60 and 100');

const REQUIRED_ANCHORS = [
  'node-insert.cjs',
  'writeEdge',
  'memory-events.cjs',
  'rs-sqlite-mirror.cjs',
  'typed-claim.cjs:121',
  'reasoning-write.cjs:185',
  'SOURCED_FROM',
  'D-169-11',
  'PRAGMA table_info',
  'openRoomDbReadOnlyForCaller',
  '.mindrian/room.db',
  'Phase 273',
];
for (const anchor of REQUIRED_ANCHORS) {
  assert.ok(contextText.includes(anchor), 'CONTEXT.md is missing required anchor: ' + anchor);
  ok('CONTEXT.md contains anchor: ' + anchor);
}

assert.strictEqual(
  (contextText.match(/not yet shipped/g) || []).length,
  0,
  'CONTEXT.md must not call any shipped module "not yet shipped"'
);
ok('CONTEXT.md contains no "not yet shipped" claim');

// ---------------------------------------------------------------------------
// Arm 2: the routing row from the include that loads with CLAUDE.md.
// ---------------------------------------------------------------------------
const architectureMdPath = path.join(ROOT, '.claude/includes/architecture.md');
const architectureText = fs.readFileSync(architectureMdPath, 'utf8');
assert.ok(
  architectureText.includes('lib/core/navigation/CONTEXT.md'),
  '.claude/includes/architecture.md must route to lib/core/navigation/CONTEXT.md'
);
ok('.claude/includes/architecture.md routes to lib/core/navigation/CONTEXT.md');

// ---------------------------------------------------------------------------
// Arm 3: the corrected room-graph path in docs/lazygraph-schema.md.
// ---------------------------------------------------------------------------
const lazygraphSchemaPath = path.join(ROOT, 'docs/lazygraph-schema.md');
const lazygraphSchemaText = fs.readFileSync(lazygraphSchemaPath, 'utf8');
assert.strictEqual(
  lazygraphSchemaText.includes('room/.room-graph/room.db'),
  false,
  'docs/lazygraph-schema.md must not carry the wrong room-level path'
);
ok('docs/lazygraph-schema.md does not carry the wrong room/.room-graph/room.db path');

assert.ok(
  lazygraphSchemaText.includes('.mindrian/room.db'),
  'docs/lazygraph-schema.md must name the real room-level path'
);
ok('docs/lazygraph-schema.md names the real .mindrian/room.db path');

// ---------------------------------------------------------------------------
// Arm 4: the five annotated in-code sites, checked by PROXIMITY.
// ---------------------------------------------------------------------------
const ANNOTATED_FILES = [
  'lib/core/rs-engine.cjs',
  'lib/core/rs_corpus_exclude.py',
  'lib/core/cross-room-aggregator.cjs',
  'lib/core/eureka/reasoning-mode.cjs',
  'scripts/eureka-command.cjs',
];

const PROXIMITY_WINDOW = 2;

for (const rel of ANNOTATED_FILES) {
  const abs = path.join(ROOT, rel);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');

  const roomGraphLineIdx = [];
  const annotationLineIdx = [];
  lines.forEach((line, idx) => {
    if (line.includes('.room-graph')) roomGraphLineIdx.push(idx);
    if (line.includes('.mindrian/room.db')) annotationLineIdx.push(idx);
  });

  assert.ok(roomGraphLineIdx.length > 0, rel + ' must still carry a .room-graph reference (WD-16: annotate, never remove)');
  assert.ok(annotationLineIdx.length > 0, rel + ' must carry a .mindrian/room.db annotation');

  const hasProximatePair = roomGraphLineIdx.some((rgIdx) =>
    annotationLineIdx.some((annIdx) => Math.abs(annIdx - rgIdx) <= PROXIMITY_WINDOW)
  );
  assert.ok(
    hasProximatePair,
    rel + ': no .mindrian/room.db annotation found within ' + PROXIMITY_WINDOW +
      ' lines of a .room-graph reference (annotation drifted away from the entry it explains)'
  );
  ok(rel + ' carries a .mindrian/room.db annotation within ' + PROXIMITY_WINDOW + ' lines of its .room-graph entry');
}

// ---------------------------------------------------------------------------
// Arm 5: no em-dash in any of the three prose files this phase wrote.
// ---------------------------------------------------------------------------
// Built from a code point rather than a literal character so this test
// file itself never carries the banned byte sequence.
const EM_DASH = String.fromCharCode(0x2014);
const NO_EMDASH_FILES = [
  { rel: 'lib/core/navigation/CONTEXT.md', text: contextText },
  { rel: '.claude/includes/architecture.md', text: architectureText },
  { rel: 'docs/lazygraph-schema.md', text: lazygraphSchemaText },
];
for (const { rel, text } of NO_EMDASH_FILES) {
  assert.strictEqual(text.includes(EM_DASH), false, rel + ' must contain no em-dash');
  ok(rel + ' contains no em-dash');
}

console.log('');
console.log('PASS test-343-path-hygiene.cjs (' + checks + ' checks)');
