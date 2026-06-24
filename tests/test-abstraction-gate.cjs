'use strict';
/*
 * Phase 179-05 Task 1 -- the instances-vs-structures abstraction-gate proof
 * suite (SPEC Req 6; CONTEXT decision 2). The riskiest net-new surface of the
 * phase, proven the LEAST risky shape it can be.
 *
 * Asserts the four load-bearing behaviors plus the adversarial neutrality gate:
 *   (1) buildAbstractionSelector returns EXACTLY 3 options (INSTANCES / STRUCTURE
 *       / unsure) rendered as an arrow-key single-select (multiSelect:false).
 *   (2) ALWAYS-FIRE: the helper has no shouldFire predicate and no ambiguity
 *       classifier; a grep over abstraction-gate.cjs finds no skip/classifier
 *       gating, and calling the selector with any/empty input yields the same
 *       3 options (no input can suppress the gate).
 *   (3) persistAbstractionLevel writes abstraction_level as an ADDITIVE property
 *       on the EXISTING hypothesis claim node, and NO new node type or edge type
 *       is minted (the node type stays 'claim'; review_status untouched; the
 *       edges table stays empty).
 *   (4) the neutrality grep gate exits 0 over the committed neutral fixture AND
 *       FAILS (non-zero) over an adversarial fixture carrying a banned token (it
 *       actually REJECTS venture content).
 *
 * Canon Part 8: the abstraction pick + hypothesis_text are LOCAL-only; the gate
 * opens no Brain wire. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'abstraction-gate.cjs');
const NEUTRAL_CHECK = path.join(REPO_ROOT, 'scripts', 'check-abstraction-fixture-neutral.cjs');
const NEUTRAL_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'abstraction-gate-neutral.json');

let pass = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
    pass += 1;
  } catch (e) {
    console.error('  FAIL - ' + name);
    console.error('    ' + (e && e.message ? e.message : String(e)));
    process.exitCode = 1;
  }
}

const gate = require(GATE_PATH);
const gateSrc = fs.readFileSync(GATE_PATH, 'utf8');

// ---------------------------------------------------------------------------
// (1) EXACTLY 3 options, arrow-key single-select.
// ---------------------------------------------------------------------------
check('buildAbstractionSelector is an exported function', () => {
  assert.equal(typeof gate.buildAbstractionSelector, 'function');
});

check('selector returns exactly 3 options: INSTANCES / STRUCTURE / unsure', () => {
  const sel = gate.buildAbstractionSelector();
  assert.ok(Array.isArray(sel.options), 'options must be an array');
  assert.equal(sel.options.length, 3, 'must be EXACTLY 3 options; got ' + sel.options.length);
  const keys = sel.options.map(o => o.key);
  assert.deepEqual(keys, ['instances', 'structure', 'unsure'], 'keys must be instances/structure/unsure in order');
  const labels = sel.options.map(o => o.label);
  assert.deepEqual(labels, ['INSTANCES', 'STRUCTURE', 'unsure'], 'labels must be INSTANCES/STRUCTURE/unsure');
});

check('selector renders as an arrow-key single-select AskUserQuestion card', () => {
  const sel = gate.buildAbstractionSelector();
  assert.equal(sel.multiSelect, false, 'must be single-select (multiSelect:false), not a checkbox');
  assert.equal(sel.keyboard, 'arrow-key', 'must honor the arrow-key keyboard contract');
  // Shape F single-select sub-shape (routes through the SEED-020 dispatcher).
  assert.ok(/^F\./.test(sel.shape), 'must declare a Shape F sub-shape; got ' + sel.shape);
  assert.ok(typeof sel.question === 'string' && /INSTANCES/.test(sel.question) && /STRUCTURE/.test(sel.question),
    'the question must name the INSTANCES vs STRUCTURE distinction');
});

check('the dispatcher constructs the single-select archetype (no bespoke dialog; SEED-020)', () => {
  // The gate declares the Shape F single-select; the construction of the
  // AskUserQuestion mode lives in the dispatcher. Assert the dispatcher resolves
  // a single-select (multiSelect:false) for an unmapped reach -- the default
  // 'select' archetype -- so the abstraction card routes through the one door,
  // not a bespoke selector.
  const disp = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
  const arch = disp.resolveArchetype('abstraction-gate');
  assert.equal(arch, 'select', 'an unmapped reach defaults to the single-select archetype');
});

// ---------------------------------------------------------------------------
// (2) ALWAYS-FIRE: no classifier, no shouldFire branch.
// ---------------------------------------------------------------------------
check('abstraction-gate has NO shouldFire predicate and NO ambiguity classifier (always-fire)', () => {
  // Source-level proof: the always-fire contract forbids any skip/classifier
  // gating. A 'shouldFire'/'should_fire' predicate or an 'ambiguityClassifier'/
  // 'classifyAmbiguity' branch would be a conditional skip -- the exact net-new
  // classifier risk the design fences out.
  assert.ok(!/shouldfire|should_fire/i.test(gateSrc), 'no shouldFire predicate allowed');
  assert.ok(!/ambiguityclassifier|classifyambiguity|ambiguity_classifier/i.test(gateSrc),
    'no ambiguity classifier allowed');
});

check('selector is unconditional: any/empty input yields the same 3 options', () => {
  const a = gate.buildAbstractionSelector();
  const b = gate.buildAbstractionSelector({});
  const c = gate.buildAbstractionSelector({ header: 'state your testable claim' });
  const d = gate.buildAbstractionSelector(null);
  for (const sel of [a, b, c, d]) {
    assert.equal(sel.options.length, 3, 'every call yields 3 options regardless of input');
    assert.deepEqual(sel.options.map(o => o.key), ['instances', 'structure', 'unsure']);
  }
  // A role-aware header overrides framing but NEVER the option set.
  assert.equal(c.header, 'state your testable claim');
});

// ---------------------------------------------------------------------------
// (3) persistence: additive property, no new node/edge type.
// ---------------------------------------------------------------------------
let sqliteAvailable = true;
try { require('node:sqlite'); } catch (_e) { sqliteAvailable = false; }

if (!sqliteAvailable) {
  console.log('  skip - persistence assertions (node:sqlite unavailable)');
} else {
  const { DatabaseSync } = require('node:sqlite');
  const { writeClaimNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

  check('persistAbstractionLevel writes abstraction_level as an additive property on the claim node', () => {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    // Mint the Wave-4 hypothesis truth-claim first.
    const claim = writeClaimNode(db, {
      knowledge_type: 'assumption',
      text: 'I believe X drives Y.',
      sessionId: 's-179-05',
      sourceSegment: 'hypothesis',
    });
    assert.equal(claim.ok, true, 'writeClaimNode must succeed; got ' + JSON.stringify(claim));

    const before = db.prepare('SELECT type, review_status, properties FROM nodes WHERE id = ?').get(claim.node_id);
    assert.equal(before.type, 'claim');
    assert.equal(before.review_status, 'proposed');

    const r = gate.persistAbstractionLevel(db, { nodeId: claim.node_id, abstraction_level: 'STRUCTURE' });
    assert.equal(r.ok, true, 'persist must succeed; got ' + JSON.stringify(r));
    assert.equal(r.abstraction_level, 'structure', 'STRUCTURE normalizes to structure');

    const after = db.prepare('SELECT type, review_status, properties FROM nodes WHERE id = ?').get(claim.node_id);
    // The abstraction_level rides INSIDE the properties blob -- additive, no DDL column.
    const props = JSON.parse(after.properties);
    assert.equal(props.abstraction_level, 'structure', 'abstraction_level persists in the properties blob');
    // The pre-existing knowledge_type prop is preserved byte-stable (additive merge).
    assert.equal(props.knowledge_type, 'assumption', 'the prior knowledge_type prop survives the additive merge');
    // The node TYPE is unchanged (no new node type minted).
    assert.equal(after.type, 'claim', 'the node type stays claim -- no new node type minted');
    // review_status is UNTOUCHED (Part 9 role 5: the abstraction pick is not a human promotion).
    assert.equal(after.review_status, 'proposed', 'review_status is untouched (no promotion)');
  });

  check('NO new edge type is minted by the abstraction gate (edges table stays empty)', () => {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    const claim = writeClaimNode(db, {
      knowledge_type: 'assumption', text: 'I believe X drives Y.', sessionId: 's2', sourceSegment: 'h',
    });
    gate.persistAbstractionLevel(db, { nodeId: claim.node_id, abstraction_level: 'instances' });
    const edgeCount = db.prepare('SELECT COUNT(*) AS n FROM edges').get();
    assert.equal(edgeCount.n, 0, 'the abstraction gate must mint NO edge; edges table must stay empty');
    // And no new node row beyond the single claim node.
    const nodeCount = db.prepare('SELECT COUNT(*) AS n FROM nodes').get();
    assert.equal(nodeCount.n, 1, 'no new node minted; only the original claim node exists');
  });

  check('persistAbstractionLevel rejects an invalid abstraction level and a missing node', () => {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    const claim = writeClaimNode(db, {
      knowledge_type: 'assumption', text: 'I believe X drives Y.', sessionId: 's3', sourceSegment: 'h',
    });
    const bad = gate.persistAbstractionLevel(db, { nodeId: claim.node_id, abstraction_level: 'sideways' });
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'invalid_abstraction_level');
    const missing = gate.persistAbstractionLevel(db, { nodeId: 'claim:nope', abstraction_level: 'unsure' });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'node_not_found');
  });
}

// ---------------------------------------------------------------------------
// (4) the adversarial neutrality grep gate.
// ---------------------------------------------------------------------------
check('the neutrality gate exits 0 over the committed neutral fixture', () => {
  // node scripts/check-abstraction-fixture-neutral.cjs --check  (scans the
  // committed neutral fixture + the gate source). Exit 0 = domain-neutral.
  execFileSync('node', [NEUTRAL_CHECK, '--check'], { cwd: REPO_ROOT, stdio: 'pipe' });
});

check('the neutrality gate REJECTS an adversarial fixture carrying a banned token (fails CLOSED)', () => {
  // Synthesize a temp adversarial fixture with a banned domain token, point the
  // gate at it via --file, and assert it exits NON-ZERO. This proves the gate
  // actually rejects venture content (not just that the neutral fixture passes).
  const tmp = path.join(os.tmpdir(), 'abstraction-adversarial-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify({ hypothesis_text: 'I believe the AION oncology drug drives tumor response.' }), 'utf8');
  let exitCode = 0;
  try {
    execFileSync('node', [NEUTRAL_CHECK, '--check', '--file', tmp], { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (e) {
    exitCode = (e && typeof e.status === 'number') ? e.status : 1;
  } finally {
    try { fs.unlinkSync(tmp); } catch (_e) { /* best effort */ }
  }
  assert.notEqual(exitCode, 0, 'the gate MUST fail closed (non-zero) on a banned-token fixture');
});

check('the committed neutral fixture carries zero banned tokens (direct grep)', () => {
  const text = fs.readFileSync(NEUTRAL_FIXTURE, 'utf8');
  const checker = require(NEUTRAL_CHECK);
  const violations = checker.scanText('tests/fixtures/abstraction-gate-neutral.json', text);
  assert.equal(violations.length, 0, 'neutral fixture must be clean; got ' + JSON.stringify(violations));
});

console.log('\nabstraction-gate proof suite: ' + pass + ' checks passed' +
  (process.exitCode ? ' (with failures above)' : ''));
