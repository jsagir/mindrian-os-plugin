'use strict';
// Phase 203-02 Task 2 -- the --from-expert materializer test suite.
//
// Proves scripts/build-new-surface.cjs GENERALIZES the shipped Phase-167 surface
// generator (Part 7, no fork) with a --from-expert node-read that projects a
// CONFIRMED SyntheticExpert node into a room-scoped skills/<expert>/SKILL.md:
//   - the emit rides the EXISTING surfacePath(kind='skill') path (no bespoke emitter)
//   - the emitted SKILL.md is born EXCLUDED (connector.excluded:true + reason), a
//     render-only capability lens carrying NO reach_id and NO hitl_shape (Part 11 R16
//     exemption, the disposition split from the born-WIRED commands/skill.md door)
//   - --check proves the exclusion is well-formed
//   - only a CONFIRMED node materializes; a PROPOSED node is REFUSED (Part 9 role 5)
//
// Canon Part 8: the fixture db is an in-memory SQLite over a caller-owned handle;
//   the emit writes to a tmp outDir (MINDRIAN_SURFACE_OUT_DIR), never the repo tree.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const genPath = path.join(REPO_ROOT, 'scripts', 'build-new-surface.cjs');
const gen = require(genPath);
const { writeSyntheticExpertNode } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));

// In-memory db with the Phase-109-migrated nodes schema (mirrors the shipped
// tests/test-203-genesis-fanout.cjs freshDb). No SKIP path.
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  last_modified_at INTEGER, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER, ' +
    '  invalidated_at INTEGER, ' +
    '  valid_to INTEGER' +
    ')'
  );
  return db;
}

// Seed a SyntheticExpert through the SHIPPED writer (lands 'proposed'); optionally
// promote to 'confirmed' (the human-gate step Part 9 role 5 requires before reuse).
function seedExpert(db, params, status) {
  const w = writeSyntheticExpertNode(db, params);
  if (!w.ok) throw new Error('seed failed: ' + w.reason);
  if (status && status !== 'proposed') {
    db.prepare('UPDATE nodes SET review_status = ? WHERE id = ?').run(status, w.node_id);
  }
  return w.node_id;
}

const BQ = 'How does resilience hold up when the SWOT and TRIZ lenses disagree about adaptation?';
const RA = 'Cross-examine adaptation through the SWOT / TRIZ frameworks, then synthesize the Green-hat stance.';

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    console.error('  FAIL -', label, '\n   ', e && e.message);
    process.exitCode = 1;
  }
}

console.log('test-203-skill-materialize:');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-mat-'));

check('materialize CONFIRMED expert emits skills/<surname>/SKILL.md with hat + beautiful_question, born EXCLUDED', () => {
  const db = freshDb();
  seedExpert(db, {
    hat: 'Green', name: 'Resilience', surname: 'Adaptation',
    archetype: 'Synthetic Resilience Expert', beautifulQuestion: BQ,
    researchApproach: RA, evidenceTier: 'Academic',
    provenance: { runId: 'genesis:test', domainNodeIds: ['domain:adaptation'] },
    sessionId: 'genesis-test',
  }, 'confirmed');

  const outDir = path.join(tmpRoot, 'case1');
  const res = gen.materializeExpertSkill(db, 'Adaptation', { outDir });
  assert.equal(res.ok, true, 'materialize should succeed for a confirmed expert');
  assert.equal(res.name, 'adaptation', 'name should be the surname slug');

  const dest = path.join(outDir, 'skills', 'adaptation', 'SKILL.md');
  assert.ok(fs.existsSync(dest), 'the SKILL.md should be emitted at skills/adaptation/SKILL.md');
  const body = fs.readFileSync(dest, 'utf8');

  assert.ok(body.includes('Green'), 'body carries the hat');
  assert.ok(body.includes(BQ), 'body carries the beautiful question');
  assert.ok(/excluded:\s*true/.test(body), 'connector is stamped excluded: true');
  assert.ok(body.includes('render-only expert capability lens (Part 11 R16 exemption)'), 'connector carries the R16-exemption reason');
  assert.ok(!/reach_id/.test(body), 'a render-only excluded skill carries NO reach_id (no 7th reach)');
  assert.ok(!/hitl_shape/.test(body), 'the emitted skill carries NO hitl_shape (that lives on the WIRED front door)');
  db.close();
});

check('--check passes for the emitted render-only EXCLUDED skill', () => {
  const outDir = path.join(tmpRoot, 'case1');
  const out = execFileSync('node',
    [genPath, '--check', '--kind', 'skill', '--name', 'adaptation'],
    { cwd: REPO_ROOT, env: Object.assign({}, process.env, { MINDRIAN_SURFACE_OUT_DIR: outDir }), encoding: 'utf8' });
  assert.ok(/OK/.test(out), '--check should report OK for the well-formed exclusion');
});

check('a PROPOSED (not confirmed) node is REFUSED, no file emitted (Part 9 role 5)', () => {
  const db = freshDb();
  seedExpert(db, {
    hat: 'Black', name: 'Risk', surname: 'Proposed',
    archetype: 'Synthetic Risk Expert', beautifulQuestion: 'Where does it break?',
    researchApproach: 'Adversarial probe.', evidenceTier: 'Operational',
    sessionId: 'genesis-test',
  }, 'proposed');

  const outDir = path.join(tmpRoot, 'case3');
  const res = gen.materializeExpertSkill(db, 'Proposed', { outDir });
  assert.equal(res.ok, false, 'a proposed node must not materialize');
  assert.equal(res.refused, true, 'the refusal is explicit');
  const dest = path.join(outDir, 'skills', 'proposed', 'SKILL.md');
  assert.ok(!fs.existsSync(dest), 'no file is emitted for a refused (proposed) node');
  db.close();
});

console.log('  ' + pass + '/' + total + ' passed');
if (pass !== total) process.exit(1);
