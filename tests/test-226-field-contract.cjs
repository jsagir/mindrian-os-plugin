#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-02 -- the D4 / G-5 OUTPUT-SHAPE byte-parity test (REQ-3).
 *
 * WHY THIS TEST EXISTS (the failure it forbids)
 *   The ROADMAP hard requirement is that reasoning-mode emits the SAME
 *   { provenance, ranked, tail, statements } shape embedded mode already writes,
 *   with the exact embedded statements[] field names plus mode:'reasoning' and
 *   honest-null encoder legs - NOT a second, divergent shape that breaks every
 *   existing consumer of eureka's output.
 *
 * It drives the REAL emitter (scripts/eureka-portfolio-report.cjs, never a
 * reimplementation) end to end in a hermetic temp room: main() with
 * --force-encoder-unavailable degrades and seeds pairs.json, then the session
 * (here: the fixture module) writes mappings.json + answers.json, then
 * reasoningStageEmit + reasoningStageScore write the report. The field-name lists
 * asserted are LITERAL copies of the shipped embedded writer, so a drift in
 * either path fails this test.
 *
 * The aggregator runs this under NODE_OPTIONS=--require tests/eureka-offline-preload.cjs
 * (zero-network guard). Standalone: node tests/test-226-field-contract.cjs.
 * node:assert strict, node built-ins + in-repo requires only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { FIXTURE_PAIRS } = require(path.join(REPO_ROOT, 'tests', 'fixtures', '226-reasoning-pairs.cjs'));

// -- The LITERAL field-name contracts, copied from the shipped embedded writer. --
// Embedded jsonOut.statements[] keys (eureka-portfolio-report.cjs statements map).
const EMBEDDED_STATEMENT_KEYS = [
  'rank', 'a', 'b', 'tail_flag', 'text', 'banked', 'critic', 'weak_dimensions', 'potential_tier',
];
// The reasoning extensions buildReasoningStatement adds on top.
const REASONING_STATEMENT_EXT = [
  'mode', 'lsa_similarity', 'lexical_method', 'differential_score', 'semantic_similarity', 'reasoning_tag',
];
// Every key the embedded provenance object emits (lines ~975-1012 of the runner).
const EMBEDDED_PROVENANCE_KEYS = [
  'run_mode', 'pairs_mode', 'encoder_model', 'encoder_dtype', 'vec_backend', 'ahp_weights',
  'ahp_cr', 'ahp_matrix_source', 'tail_composition', 'growth_proxy', 'tail_thresholds',
  'tail_insufficient_structure', 'tail_suspect_noise', 'cohort_techs', 'graph_nodes',
  'converges_pairs', 'pairs_scored', 'scaffold_pairs_excluded', 'figure_guard_skipped',
  'critic_resolution', 'honest_nouns', 'encoder_unavailable', 'run_date',
];

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 2) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load, exploring how ' + a
    + ' and ' + b + ' couple across the boundary of this domain in several sentences.';
}

// Build a hermetic room: room.db with 6 nodes across 2 sections, matching markdown
// entries on disk (readRoomMarkdown reads disk directly), and a minimal idea-graph.
function makeFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-fc-'));
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
    // Markdown entry on disk for readRoomMarkdown (outside .mindrian).
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
    JSON.stringify({ meta: { honest_nouns: 'hermetic 226 fixture' }, elements: { nodes: nodes, edges: edges } }),
    'utf8');
}

async function main() {
  const dir = makeFixtureRoom();
  const graphPath = path.join(dir, 'idea-graph.json');
  makeFixtureGraph(graphPath);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'report.md');
  const jsonPath = path.join(dir, 'report.json');

  // NOTE: no --offline here. The _forceUnavailable seam short-circuits getEncoder
  // BEFORE any model load (embedding-spine.cjs), but the offline encodeFn injection
  // seam runs FIRST and would win, so forcing encoder_unavailable requires the
  // non-offline path. The offline preload still pins allowRemoteModels=false, so no
  // network is reached (the seam returns unavailable before touching the model).
  const baseArgs = [
    '--db', dir, '--graph', graphPath, '--pairs', 'graph',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ];

  // (1) Drive the REAL degrade via main() with the deterministic force seam.
  const code0 = await runner.main(baseArgs.concat(['--force-encoder-unavailable']));
  assert.strictEqual(code0, 0, 'degrade run main() exits 0 (got ' + code0 + ')');

  const pairsPath = path.join(workdir, 'pairs.json');
  assert.ok(fs.existsSync(pairsPath), 'the degrade run seeded pairs.json');
  const pairsDoc = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
  assert.strictEqual(pairsDoc.degrade_cause, 'encoder_unavailable',
    "pairs.json degrade_cause is 'encoder_unavailable' (got " + JSON.stringify(pairsDoc.degrade_cause) + ')');
  assert.ok(Array.isArray(pairsDoc.candidates) && pairsDoc.candidates.length > 0,
    'the degrade seeded at least one candidate pair (got ' + (pairsDoc.candidates || []).length + ')');

  // The degrade REPORT json (written by main before the reasoning stages) already
  // names the cause in provenance.
  const degradeJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.strictEqual(degradeJson.provenance.degrade_cause, 'encoder_unavailable',
    'the degrade report provenance names the cause');

  // (2) The session writes mappings + answers, keyed by the SEEDED candidate ids
  //     (fixtures assigned in order so the ids line up with pairs.json).
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

  // (3) Emit + score through the REAL exported stages.
  const codeE = await runner.reasoningStageEmit(runner.parseArgv(baseArgs.concat(['--reasoning-emit'])));
  assert.strictEqual(codeE, 0, 'reasoningStageEmit exits 0 (got ' + codeE + ')');
  const codeS = await runner.reasoningStageScore(runner.parseArgv(baseArgs.concat(['--reasoning-score'])));
  assert.strictEqual(codeS, 0, 'reasoningStageScore exits 0 (got ' + codeS + ')');

  // -- Parse the written reasoning report and assert the byte-parity contract. --
  const out = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // (1) top-level keys exactly the four.
  assert.deepStrictEqual(Object.keys(out).sort(), ['provenance', 'ranked', 'statements', 'tail'],
    'top-level keys are exactly { provenance, ranked, tail, statements }');

  // (5) provenance.run_mode is the reasoning label (D6 JSON leg).
  assert.strictEqual(out.provenance.run_mode, 'reasoning', "provenance.run_mode === 'reasoning'");

  // (2) every statements[] row: exact embedded names + the reasoning extensions,
  //     with the honest null / false / label values.
  const expectedStmtKeys = EMBEDDED_STATEMENT_KEYS.concat(REASONING_STATEMENT_EXT).slice().sort();
  assert.ok(out.statements.length > 0, 'at least one reasoning statement was written');
  for (let i = 0; i < out.statements.length; i += 1) {
    const s = out.statements[i];
    assert.deepStrictEqual(Object.keys(s).slice().sort(), expectedStmtKeys,
      'statement[' + i + '] carries EXACTLY the embedded field names plus the reasoning extensions');
    assert.strictEqual(s.differential_score, null, 'statement[' + i + '] differential_score is null (D1)');
    assert.strictEqual(s.semantic_similarity, null, 'statement[' + i + '] semantic_similarity is null (D1)');
    assert.strictEqual(s.banked, false, 'statement[' + i + '] banked is false (G-3)');
    assert.strictEqual(s.mode, 'reasoning', 'statement[' + i + "] mode is 'reasoning'");
    assert.strictEqual(s.lexical_method, 'jaccard-v1', 'statement[' + i + '] lexical_method is jaccard-v1');
    assert.ok(typeof s.lsa_similarity === 'number' && s.lsa_similarity >= 0 && s.lsa_similarity <= 1,
      'statement[' + i + '] lsa_similarity is a real [0,1] number');
  }

  // (2b) ranked rows carry the honest-null legs + mode too (assertReasoningInvariants
  //      guards these on both arrays; re-assert them on the real emitter output).
  for (let i = 0; i < out.ranked.length; i += 1) {
    const r = out.ranked[i];
    assert.strictEqual(r.score, null, 'ranked[' + i + '] score is null (no fabricated composite)');
    assert.strictEqual(r.differential_score, null, 'ranked[' + i + '] differential_score is null');
    assert.strictEqual(r.semantic_similarity, null, 'ranked[' + i + '] semantic_similarity is null');
    assert.strictEqual(r.banked, false, 'ranked[' + i + '] banked is false');
    assert.strictEqual(r.mode, 'reasoning', 'ranked[' + i + "] mode is 'reasoning'");
  }

  // (3) provenance carries every embedded key PLUS the reasoning keys.
  for (let i = 0; i < EMBEDDED_PROVENANCE_KEYS.length; i += 1) {
    const k = EMBEDDED_PROVENANCE_KEYS[i];
    assert.ok(Object.prototype.hasOwnProperty.call(out.provenance, k),
      'reasoning provenance carries the embedded key `' + k + '`');
  }
  assert.strictEqual(out.provenance.formula_version, 'eureka-reasoning-v1',
    "provenance.formula_version === 'eureka-reasoning-v1'");
  assert.ok(out.provenance.pairs_sent <= out.provenance.reasoning_cap,
    'pairs_sent (' + out.provenance.pairs_sent + ') <= reasoning_cap (' + out.provenance.reasoning_cap + ')');
  assert.ok(out.provenance.pairs_rejected_by_rubric
    && typeof out.provenance.pairs_rejected_by_rubric === 'object',
    'provenance carries pairs_rejected_by_rubric');
  assert.strictEqual(out.provenance.banking, 'skipped (reasoning mode: Part 9 human-only promotion)',
    'provenance.banking names the hard-skip');
  assert.strictEqual(out.provenance.degrade_cause, 'encoder_unavailable',
    'provenance.degrade_cause carried through from the seed');

  // (4) tail: the same six keys, honest empties.
  assert.deepStrictEqual(Object.keys(out.tail).slice().sort(),
    ['composition', 'growth_proxy', 'insufficient_structure', 'items', 'suspect_noise', 'thresholds'],
    'tail carries the same six keys');
  assert.strictEqual(out.tail.items.length, 0, 'tail.items is empty in reasoning mode');
  assert.strictEqual(out.tail.thresholds, null, 'tail.thresholds is null in reasoning mode');

  // (6) the md report leads with the caveat and names reasoning before provenance.
  const md = fs.readFileSync(outPath, 'utf8');
  const caveatIdx = md.indexOf('reasoning-mode caveat');
  const provIdx = md.indexOf('## Provenance');
  assert.ok(caveatIdx >= 0, 'the md report contains the reasoning-mode caveat block');
  assert.ok(caveatIdx < provIdx, 'the caveat block appears BEFORE the provenance table');
  assert.ok(/reasoning/i.test(md), "the md report names 'reasoning'");

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.stdout.write('test-226-field-contract: PASS (' + out.statements.length + ' statements, '
    + out.ranked.length + ' ranked; byte-parity + null legs proven against the real emitter)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-field-contract: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
