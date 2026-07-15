#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-04 -- D5 / G-3 WORKING-DIAGNOSIS POSTURE (REQ-4).
 *
 * WHY THIS TEST EXISTS (the failure it forbids)
 *   Reasoning mode is a LOWER-CONFIDENCE working diagnosis, never a banked truth.
 *   Three posture invariants must hold on the REAL emitter output, asserted by
 *   CODE (a judge can be wrong; an assertion cannot):
 *     (1) banked === false (literal, not truthiness) on every statement row, the
 *         Canon Part 9 human-only-promotion invariant (G-3);
 *     (2) ZERO opportunity nodes are written to room.db by the reasoning path -
 *         the banking hard-skip proved against the real db, not a source grep;
 *     (3) provenance.banking names the skip reason string.
 *   Plus the upgrade posture (D6): a later embedded re-run over the same room
 *   surfaces a provenance.upgrade DELTA (previous reasoning result visible), and
 *   the old reasoning ranked rows are NEVER merged into the new embedded table.
 *   Plus the SHORT-list rule: ranked.length <= reasoning_cap.
 *   Plus the FIELD-PARITY LIVE DIFF (plan-checker Warning 1 fix): the embedded
 *   statement row's Object.keys() is a SUBSET of the reasoning statement row's
 *   Object.keys(), compared against a REAL embedded-path run (not a hand-copied
 *   literal list), so a future embedded field rename that forgets the reasoning
 *   emitter is caught here even if the field-contract literal list is stale.
 *
 * Hermetic temp room, the field-contract three-stage pattern. Runs under the
 * aggregator's NODE_OPTIONS=--require tests/eureka-offline-preload.cjs zero-network
 * guard. Standalone: node tests/test-226-posture.cjs. node:assert strict, node
 * built-ins + in-repo requires only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { FIXTURE_PAIRS } = require(path.join(REPO_ROOT, 'tests', 'fixtures', '226-reasoning-pairs.cjs'));

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 2) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load, exploring how ' + a
    + ' and ' + b + ' couple across the boundary of this domain in several sentences.';
}

// Hermetic room: room.db with 6 Claim nodes across 2 sections + matching markdown
// entries on disk (readRoomMarkdown reads disk directly). Mirrors the plan-02
// field-contract fixture so the two legs exercise the same real flow.
function makeFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-posture-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    const section = inA ? 'physics' : 'biology';
    const body = bodyFor(i, inA ? POOL_A : POOL_B);
    ins.run(id, 'Claim', JSON.stringify({ text: body, section: section, parentId: inA ? 'DOM_A' : 'DOM_B' }),
      'fixture://' + id, 'import', now, now);
    const secDir = path.join(dir, section);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, id + '.md'), '# ' + section + ' tech ' + i + '\n\n' + body + '\n', 'utf8');
  }
  closeRoomDb(db);
  return dir;
}

function makeFixtureGraph(graphPath) {
  const nodes = [];
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    nodes.push({
      data: {
        id: id, cnumber: id, title: (inA ? 'physics tech ' : 'biology tech ') + i,
        primary_tier: 1, pair_count: 5 + i, degree: 10 + i,
        section: inA ? 'physics' : 'biology',
        primary_problem: (inA ? 'energy transport gap ' : 'cell signaling gap ') + i,
        problems: [(inA ? 'energy transport gap ' : 'cell signaling gap ') + i],
      },
    });
  }
  const edges = [
    { data: { type: 'CONVERGES', source: 'C00001', target: 'C00004', shared_problems: ['cross-domain bridge'] } },
    { data: { type: 'CONVERGES', source: 'C00002', target: 'C00005', shared_problems: ['boundary coupling'] } },
  ];
  fs.writeFileSync(graphPath,
    JSON.stringify({ meta: { honest_nouns: 'hermetic 226 posture fixture' }, elements: { nodes: nodes, edges: edges } }),
    'utf8');
}

// Count opportunity nodes in the REAL room.db (the test-219-banking query idiom).
function opportunityNodeCount(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get();
    return row.n;
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  const dir = makeFixtureRoom();
  const graphPath = path.join(dir, 'idea-graph.json');
  makeFixtureGraph(graphPath);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'report.md');
  const jsonPath = path.join(dir, 'report.json');

  const baseArgs = [
    '--db', dir, '--graph', graphPath, '--pairs', 'graph',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ];

  // ----- (A) Drive the REAL reasoning flow: degrade seed -> emit -> score. -----
  const code0 = await runner.main(baseArgs.concat(['--force-encoder-unavailable']));
  assert.strictEqual(code0, 0, 'degrade run main() exits 0 (got ' + code0 + ')');

  const pairsDoc = JSON.parse(fs.readFileSync(path.join(workdir, 'pairs.json'), 'utf8'));
  assert.ok(pairsDoc.candidates.length > 0, 'the degrade seeded at least one candidate pair');

  const mappings = {};
  const answers = {};
  for (let i = 0; i < pairsDoc.candidates.length; i += 1) {
    const c = pairsDoc.candidates[i];
    const f = FIXTURE_PAIRS[i % FIXTURE_PAIRS.length];
    mappings[c.id] = { mechanismText: f.mechanismText, mappingStatement: f.mappingStatement };
    answers[c.id] = { neutral: f.neutral, adversarial: f.adversarial };
  }
  fs.writeFileSync(path.join(workdir, 'mappings.json'), JSON.stringify(mappings), 'utf8');
  fs.writeFileSync(path.join(workdir, 'answers.json'), JSON.stringify(answers), 'utf8');

  const codeE = await runner.reasoningStageEmit(runner.parseArgv(baseArgs.concat(['--reasoning-emit'])));
  assert.strictEqual(codeE, 0, 'reasoningStageEmit exits 0 (got ' + codeE + ')');
  const codeS = await runner.reasoningStageScore(runner.parseArgv(baseArgs.concat(['--reasoning-score'])));
  assert.strictEqual(codeS, 0, 'reasoningStageScore exits 0 (got ' + codeS + ')');

  const reasoningJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const reasoningMd = fs.readFileSync(outPath, 'utf8');

  assert.ok(reasoningJson.statements.length > 0, 'the reasoning run wrote at least one statement');

  // ----- (1) banked === false LITERAL on every statement row (G-3). -----
  for (let i = 0; i < reasoningJson.statements.length; i += 1) {
    assert.strictEqual(reasoningJson.statements[i].banked, false,
      'statement[' + i + '] banked is the literal false (G-3, Canon Part 9)');
  }
  for (let i = 0; i < reasoningJson.ranked.length; i += 1) {
    assert.strictEqual(reasoningJson.ranked[i].banked, false,
      'ranked[' + i + '] banked is the literal false (G-3)');
  }

  // ----- (2) ZERO opportunity nodes in the REAL room.db (banking hard-skip). -----
  const oppCount = opportunityNodeCount(dir);
  assert.strictEqual(oppCount, 0,
    'the reasoning path wrote ZERO opportunity nodes to room.db (banking hard-skip proven against the db, got ' + oppCount + ')');

  // ----- (3) provenance.banking names the skip reason string. -----
  assert.strictEqual(reasoningJson.provenance.banking,
    'skipped (reasoning mode: Part 9 human-only promotion)',
    'provenance.banking names the hard-skip reason');

  // ----- (5) the ranked list is SHORT: ranked.length <= reasoning_cap. -----
  assert.ok(reasoningJson.ranked.length <= reasoningJson.provenance.reasoning_cap,
    'ranked.length (' + reasoningJson.ranked.length + ') <= reasoning_cap ('
    + reasoningJson.provenance.reasoning_cap + ')');

  // Capture the reasoning ranked pair identity set + one statement row for the
  // upgrade + field-parity legs before the embedded run overwrites the report.
  const reasoningRankedPairs = new Set(
    reasoningJson.ranked.map(function (r) { return String(r.a) + '|' + String(r.b); })
  );
  const reasoningStatementKeys = Object.keys(reasoningJson.statements[0]);

  // ----- (4) UPGRADE DELTA: a later embedded run surfaces the prior result. -----
  // Re-run the embedded path over the SAME room with --offline (stub encoder,
  // idx.embedded true). buildUpgradeDelta reads the prior reasoning json at
  // jsonPath BEFORE overwriting it, so the new embedded report carries the delta.
  const codeUp = await runner.main([
    '--db', dir, '--graph', graphPath, '--pairs', 'graph', '--offline',
    '--out', outPath, '--json', jsonPath,
  ]);
  assert.strictEqual(codeUp, 0, 'embedded upgrade run main() exits 0 (got ' + codeUp + ')');

  const embeddedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const embeddedMd = fs.readFileSync(outPath, 'utf8');

  assert.strictEqual(embeddedJson.provenance.run_mode, 'offline (deterministic stub encoder)',
    'the upgrade run is a genuine embedded (offline stub) run, not reasoning');
  assert.ok(embeddedJson.provenance.upgrade && typeof embeddedJson.provenance.upgrade === 'object',
    'the embedded run carries provenance.upgrade (prior reasoning result surfaced, not silently replaced)');
  const up = embeddedJson.provenance.upgrade;
  assert.strictEqual(up.previous_run_mode, 'reasoning', "upgrade.previous_run_mode === 'reasoning'");
  assert.ok(typeof up.previous_run_date === 'string' && up.previous_run_date.length > 0,
    'upgrade.previous_run_date is a non-empty string');
  assert.ok(Array.isArray(up.previous_top), 'upgrade.previous_top is an array');
  assert.ok(typeof up.survived === 'number', 'upgrade.survived is a number');
  assert.ok(typeof up.demoted_or_absent === 'number', 'upgrade.demoted_or_absent is a number');
  assert.strictEqual(up.survived + up.demoted_or_absent, up.previous_top.length,
    'survived + demoted_or_absent === previous_top.length (accounting closes)');

  // The md carries the upgrade section heading.
  assert.ok(embeddedMd.indexOf('## Reasoning to embedded upgrade') >= 0,
    'the embedded md report carries the upgrade section heading');

  // The OLD reasoning ranked rows are NEVER merged into the new embedded ranked
  // table (D6). Two proofs: (a) no embedded ranked row shares a reasoning ranked
  // pair identity, and (b) every embedded ranked row is a genuine embedded row
  // (numeric score, no reasoning verdict/tag) - the reasoning rows carried
  // score:null + a verdict field, so their presence would be unmistakable.
  for (let i = 0; i < embeddedJson.ranked.length; i += 1) {
    const r = embeddedJson.ranked[i];
    const key = String(r.a) + '|' + String(r.b);
    assert.ok(!reasoningRankedPairs.has(key),
      'embedded ranked[' + i + '] (' + key + ') is not a merged-in reasoning ranked row');
    assert.strictEqual(typeof r.score, 'number',
      'embedded ranked[' + i + '] has a numeric score (a real embedded row, not a null-score reasoning row)');
    assert.ok(!Object.prototype.hasOwnProperty.call(r, 'verdict'),
      'embedded ranked[' + i + '] carries no reasoning verdict field (tables never merged)');
  }

  // ----- (6) FIELD-PARITY LIVE DIFF against the REAL embedded emitter. -----
  // The embedded statement row's key set must be a SUBSET of the reasoning
  // statement row's key set. Reasoning may carry additive fields (mode-specific
  // provenance the embedded row lacks) but NEVER the reverse: any embedded key
  // absent from the reasoning row is a real parity break. This is a live compare
  // against the current embedded emitter, not a hand-copied literal list.
  assert.ok(embeddedJson.statements.length > 0, 'the embedded upgrade run wrote at least one statement');
  const embeddedStatementKeys = Object.keys(embeddedJson.statements[0]);
  const reasoningKeySet = new Set(reasoningStatementKeys);
  const missingFromReasoning = embeddedStatementKeys.filter(function (k) { return !reasoningKeySet.has(k); });
  assert.deepStrictEqual(missingFromReasoning, [],
    'FIELD-PARITY: every embedded statement key is present in the reasoning statement row '
    + '(embedded keys must be a SUBSET of reasoning keys; missing from reasoning: '
    + JSON.stringify(missingFromReasoning) + ')');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.stdout.write('test-226-posture: PASS (' + reasoningJson.statements.length
    + ' reasoning statements banked=false, 0 opportunity nodes in room.db, upgrade delta surfaced, '
    + 'embedded keys [' + embeddedStatementKeys.length + '] subset of reasoning keys ['
    + reasoningStatementKeys.length + '])\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-posture: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
