'use strict';
// Phase 179-04 -- the hypothesis blueprint family + truth-claim filing + per-role
// Door 3 framing proof suite (Wave 4 / REQ-05 + REQ-07).
//
// Task 1 assertions (the family + the 9-family CI gate + scaffold-resolves):
//   - data/room-blueprints.json carries a `hypothesis` family with the LOCKED
//     section set (problem-definition + assumptions + opportunity-bank) and the
//     LOCKED default_methodologies (structure-argument / challenge-assumptions /
//     validate / research), arrival_assets including `hypothesis-arrival`.
//   - check-room-blueprints.cjs is green at 9 families and accepts the
//     `assumptions` non-frozen slug.
//   - the scaffold resolves the hypothesis family section set (problem-definition
//     is scaffold-creatable; the still-non-frozen `assumptions` slug skips
//     gracefully without error).
//   - Phase 275 (D-01) promoted `opportunity-bank` INTO the frozen SECTION_NAMES
//     table; `assumptions` alone remains the non-frozen, intent-only slug.
//
// Task 2 assertions (the truth-claim filing doctrine + per-role framing):
//   - commands/ignite.md Door 3 cites writeClaimNode with review_status proposed
//     (Canon Part 9 role 5: never auto-confirmed without a human byUser).
//   - the Door 3 per-role framing map names researcher=testable claim,
//     founder=market bet, investor=thesis precondition, AND the generic
//     "I believe ___ because ___" fallback for an empty role_blend.
//   - writeClaimNode against an in-memory room.db with knowledge_type 'assumption'
//     writes a node at review_status 'proposed' (Part 9: not confirmed).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BLUEPRINTS_PATH = path.join(REPO_ROOT, 'data', 'room-blueprints.json');
const CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-room-blueprints.cjs');
const IGNITE_MD = path.join(REPO_ROOT, 'commands', 'ignite.md');

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-hypothesis-family-and-claim');

// ---------------------------------------------------------------------------
// Task 1 -- the hypothesis blueprint family + the 9-family CI gate.
// ---------------------------------------------------------------------------

const blueprints = JSON.parse(fs.readFileSync(BLUEPRINTS_PATH, 'utf8'));

check('the hypothesis family exists with the LOCKED section set + methodologies', () => {
  const h = blueprints.hypothesis;
  assert.ok(h && typeof h === 'object', 'hypothesis family must exist');
  assert.ok(Array.isArray(h.sections), 'hypothesis.sections must be an array');
  for (const slug of ['problem-definition', 'assumptions', 'opportunity-bank']) {
    assert.ok(h.sections.includes(slug), 'hypothesis.sections must include ' + slug);
  }
  assert.ok(Array.isArray(h.default_methodologies), 'hypothesis.default_methodologies must be an array');
  for (const m of ['structure-argument', 'challenge-assumptions', 'validate', 'research']) {
    assert.ok(h.default_methodologies.includes(m), 'hypothesis.default_methodologies must include ' + m);
  }
  assert.ok(Array.isArray(h.arrival_assets) && h.arrival_assets.includes('hypothesis-arrival'),
    'hypothesis.arrival_assets must include hypothesis-arrival');
});

check('exactly 9 blueprint families (the 8 prior + hypothesis, no drift)', () => {
  const familyKeys = Object.keys(blueprints).filter((k) => !k.startsWith('_'));
  assert.equal(familyKeys.length, 9, 'expected 9 families, found ' + familyKeys.length);
  for (const prior of ['exploration', 'solution-first', 'problem-first', 'business-first',
    'portfolio', 'venture', 'program', 'case-study']) {
    assert.ok(familyKeys.includes(prior), 'the prior family ' + prior + ' must be preserved');
  }
  assert.ok(familyKeys.includes('hypothesis'), 'the hypothesis family must be present');
});

check('check-room-blueprints.cjs --check exits 0 at 9 families (no drift)', () => {
  // execFileSync throws on a non-zero exit; a clean run means the gate is green.
  const out = execFileSync('node', [CHECK_SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.ok(/PASS/.test(out), 'the gate must print PASS; got: ' + out);
});

check('the check accepts the assumptions slug (the non-frozen valid-slug extension)', () => {
  const src = fs.readFileSync(CHECK_SCRIPT, 'utf8');
  assert.ok(/assumptions/.test(src), 'check-room-blueprints.cjs must reference the assumptions slug');
});

check('the scaffold resolves the hypothesis family without error', () => {
  const scaffold = require(path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
  const resolver = typeof scaffold.resolveBlueprint === 'function' ? scaffold.resolveBlueprint : null;
  if (resolver) {
    const r = resolver('hypothesis');
    assert.ok(r && Array.isArray(r.sectionList) && r.sectionList.length > 0,
      'resolveBlueprint(hypothesis) must yield a non-empty sectionList');
    // problem-definition is scaffold-creatable; the non-frozen slugs skip gracefully.
    assert.ok(r.sectionList.includes('problem-definition'),
      'the resolved section set must include the scaffold-creatable problem-definition');
  } else {
    // Fallback: the scaffold entry point exists.
    assert.equal(typeof scaffold.scaffoldRoomSkeleton, 'function',
      'the scaffold must export scaffoldRoomSkeleton');
  }
});

check('assumptions stays non-frozen; Phase 275 promoted opportunity-bank into SECTION_NAMES', () => {
  const scaffold = require(path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
  assert.ok(Array.isArray(scaffold.SECTION_NAMES), 'SECTION_NAMES must be an array');
  assert.equal(scaffold.SECTION_NAMES.includes('assumptions'), false,
    'assumptions must NOT be added to the frozen SECTION_NAMES table');
  assert.equal(scaffold.SECTION_NAMES.includes('opportunity-bank'), true,
    'Phase 275 D-01 promoted opportunity-bank into the frozen SECTION_NAMES table ' +
    '(see SEED-084 ## RULING 2026-09-04); this assertion must track that truth, not the pre-275 one');
});

// ---------------------------------------------------------------------------
// Task 2 -- the truth-claim filing doctrine + per-role Door 3 framing.
// ---------------------------------------------------------------------------

const igniteMd = fs.readFileSync(IGNITE_MD, 'utf8');

check('Door 3 cites writeClaimNode at review_status proposed (Part 9 role 5)', () => {
  assert.ok(/writeClaimNode/.test(igniteMd), 'ignite.md Door 3 must cite writeClaimNode');
  assert.ok(/review_status[^\n]*proposed|proposed[^\n]*truth-claim|truth-claim[^\n]*proposed/i.test(igniteMd),
    'ignite.md Door 3 must file the hypothesis at review_status proposed');
  assert.ok(/byUser|human/i.test(igniteMd),
    'ignite.md Door 3 must state the node is never confirmed without a human byUser');
});

check('Door 3 names all three per-role framings + the generic fallback', () => {
  // researcher -> testable claim
  assert.ok(/researcher[^\n]*testable claim/i.test(igniteMd),
    'Door 3 must frame researcher as a testable claim');
  // founder -> market bet
  assert.ok(/founder[^\n]*market bet/i.test(igniteMd),
    'Door 3 must frame founder as a market bet');
  // investor -> thesis precondition
  assert.ok(/investor[^\n]*thesis precondition/i.test(igniteMd),
    'Door 3 must frame investor as a thesis precondition');
  // generic fallback for empty role_blend
  assert.ok(/I believe ___ because ___/i.test(igniteMd),
    'Door 3 must fall back to the generic "I believe ___ because ___" prompt');
});

// (3) writeClaimNode against an in-memory room.db: knowledge_type 'assumption'
//     files at review_status 'proposed' (Part 9: never auto-confirmed).
let sqliteOk = true;
try {
  require('node:sqlite');
} catch (_e) {
  sqliteOk = false;
}

if (sqliteOk) {
  const { DatabaseSync } = require('node:sqlite');
  const { writeClaimNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

  check("the I-believe hypothesis files as knowledge_type 'assumption' at review_status proposed", () => {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    const r = writeClaimNode(db, {
      knowledge_type: 'assumption',
      text: 'I believe X drives Y',
      sessionId: 'hyp-1',
    });
    assert.equal(r.ok, true, 'writeClaimNode must succeed; got ' + JSON.stringify(r));
    const row = db.prepare('SELECT type, created_by, review_status FROM nodes WHERE id = ?').get(r.node_id);
    assert.equal(row.type, 'claim');
    assert.equal(row.review_status, 'proposed', 'a hypothesis truth-claim must NEVER mint confirmed');
    // Confirm the no-auto-confirm invariant: re-filing the same hypothesis does
    // NOT promote it to confirmed (only a human byUser at a Decision Gate does).
    const r2 = writeClaimNode(db, {
      knowledge_type: 'assumption', text: 'I believe X drives Y', sessionId: 'hyp-1',
    });
    assert.equal(r2.node_id, r.node_id, 'idempotent re-file mints the same node id');
    const row2 = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
    assert.equal(row2.review_status, 'proposed', 'no agent path reaches confirmed without a human byUser');
    db.close();
  });
} else {
  console.log('  skip - writeClaimNode in-memory assertion (node:sqlite unavailable)');
}

console.log('\ntest-hypothesis-family-and-claim: ' + pass + ' checks passed');
